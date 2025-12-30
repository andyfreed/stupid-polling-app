import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asString, fetchJsonWithRetry, parseDate } from "./_util";

const VoteHubPollSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    poll_type: z.string(),
    subject: z.any().optional(),
    sample_size: z.number().int().optional().nullable(),
    population: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    pollster: z.any().optional().nullable(),
    answers: z.array(z.any()).optional().default([]),
    sponsors: z.array(z.any()).optional().default([]),
    internal: z.boolean().optional().nullable(),
    partisan: z.boolean().optional().nullable()
  })
  .passthrough();

const VoteHubAnswerSchema = z
  .object({
    choice: z.string(),
    party: z.string().optional().nullable(),
    percent: z.number().optional().nullable(),
  })
  .passthrough();

const PollTypesSchema = z.union([
  z.array(z.string()),
  z.object({ poll_types: z.array(z.string()) }).passthrough(),
]);

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function humanizeSubject(raw: unknown): string | null {
  const s = asString(raw);
  if (!s) return null;
  // common VoteHub subject formats: "donald-trump", "Donald Trump"
  const norm = s.includes("-") ? s.replace(/-/g, " ") : s;
  return norm
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function ingestVoteHub() {
  const base = process.env.VOTEHUB_BASE_URL || "https://api.votehub.com";
  const days = Math.max(1, Number(process.env.INGEST_DAYS || "30"));

  const run = await prisma.pollRun.create({
    data: { source: "votehub", status: "running" },
  });

  const stats = { fetched: 0, upserted: 0, updated: 0, errors: 0 };

  try {
    const typesRaw = await fetchJsonWithRetry<unknown>(`${base}/poll-types`);
    const typesParsed = PollTypesSchema.safeParse(typesRaw);
    const pollTypes =
      typesParsed.success
        ? Array.isArray(typesParsed.data)
          ? typesParsed.data
          : typesParsed.data.poll_types
        : ["approval", "favorability", "generic-ballot"];

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    for (const pollType of pollTypes) {
      const url = new URL(`${base}/polls`);
      url.searchParams.set("poll_type", pollType);
      url.searchParams.set("from_date", ymd(from));
      url.searchParams.set("to_date", ymd(to));

      const raw = await fetchJsonWithRetry<unknown>(url.toString());
      const items = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && "polls" in (raw as any)
          ? (raw as any).polls
          : raw;

      if (!Array.isArray(items)) continue;

      for (const item of items) {
        stats.fetched++;
        const parsed = VoteHubPollSchema.safeParse(item);
        if (!parsed.success) {
          stats.errors++;
          continue;
        }

        const p = parsed.data;
        const sourcePollId = String(p.id);
        const subject = humanizeSubject(p.subject);
        const pollster = asString(p.pollster);
        const sponsor = p.sponsors.map(asString).filter(Boolean).join(", ") || null;
        const startDate = parseDate(p.start_date);
        const endDate = parseDate(p.end_date);

        const answers = (p.answers ?? [])
          .map((a) => VoteHubAnswerSchema.safeParse(a))
          .filter((r): r is { success: true; data: z.infer<typeof VoteHubAnswerSchema> } => r.success)
          .map((r) => ({
            choice: r.data.choice,
            party: r.data.party ?? null,
            percent: typeof r.data.percent === "number" ? r.data.percent : null,
          }));

        await prisma.poll.upsert({
          where: {
            source_sourcePollId: {
              source: "votehub",
              sourcePollId,
            },
          },
          create: {
            source: "votehub",
            sourcePollId,
            pollType: p.poll_type,
            subject,
            jurisdiction: "US",
            office: null,
            startDate,
            endDate,
            sampleSize: p.sample_size ?? null,
            population: p.population ?? null,
            pollster,
            sponsor,
            methodology: null,
            url: p.url ?? null,
            internal: p.internal ?? null,
            partisan: p.partisan ?? null,
            hypothetical: null,
            raw: item as any,
            answers: {
              create: answers,
            },
          },
          update: {
            pollType: p.poll_type,
            subject,
            jurisdiction: "US",
            startDate,
            endDate,
            sampleSize: p.sample_size ?? null,
            population: p.population ?? null,
            pollster,
            sponsor,
            url: p.url ?? null,
            internal: p.internal ?? null,
            partisan: p.partisan ?? null,
            raw: item as any,
            answers: {
              deleteMany: {},
              create: answers,
            },
          },
        });
        stats.upserted++;
      }
    }

    await prisma.pollRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        stats: stats as any,
      },
    });
    return stats;
  } catch (e) {
    await prisma.pollRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        error: e instanceof Error ? e.message : String(e),
        stats: stats as any,
      },
    });
    throw e;
  }
}
