import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { createRateLimiter, fetchJsonWithRetry, sha256Hex } from "./_util";

const CivicApiResponseSchema = z
  .object({
    count: z.number().optional(),
    polls: z.array(z.any()),
  })
  .passthrough();

const CivicApiPollSchema = z
  .object({
    title: z.string().optional().nullable(),
    pollster: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    sample: z.union([z.number(), z.string()]).optional().nullable(),
    population: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    politician: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    answers: z.array(z.any()).optional().default([]),
    url: z.string().optional().nullable(),
  })
  .passthrough();

const CivicApiAnswerSchema = z
  .object({
    choice: z.string(),
    party: z.string().optional().nullable(),
    percent: z.union([z.number(), z.string()]).optional().nullable(),
  })
  .passthrough();

function parseSample(sample: unknown): number | null {
  if (typeof sample === "number" && Number.isFinite(sample)) return Math.trunc(sample);
  if (typeof sample === "string") {
    const m = sample.replace(/,/g, "").match(/\d+/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function parsePercent(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace("%", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stableAnswersFingerprint(answers: Array<{ choice: string; party: string | null; percent: number | null }>) {
  return answers
    .slice()
    .sort((a, b) => {
      const ka = `${a.choice}|${a.party ?? ""}|${a.percent ?? ""}`;
      const kb = `${b.choice}|${b.party ?? ""}|${b.percent ?? ""}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    })
    .map((a) => `${a.choice}:${a.party ?? ""}:${a.percent ?? ""}`)
    .join(",");
}

function fingerprintPoll(p: {
  pollster: string | null;
  start_date: string | null;
  end_date: string | null;
  sample: number | null;
  population: string | null;
  state: string | null;
  title: string | null;
  politician: string | null;
  type: string | null;
  answersFp: string;
}) {
  return sha256Hex(
    [
      p.pollster ?? "",
      p.start_date ?? "",
      p.end_date ?? "",
      p.sample ?? "",
      p.population ?? "",
      p.state ?? "",
      p.title ?? "",
      p.politician ?? "",
      p.type ?? "",
      p.answersFp,
    ].join("|"),
  );
}

export async function ingestCivicApi() {
  const latestUrl =
    process.env.CIVICAPI_LATEST_URL || "https://civicapi.org/api/v2/poll/latest";

  const run = await prisma.pollRun.create({
    data: { source: "civicapi", status: "running" },
  });

  const stats = { fetched: 0, upserted: 0, errors: 0 };

  try {
    const rateLimit = createRateLimiter(40);
    await rateLimit();

    const raw = await fetchJsonWithRetry<unknown>(latestUrl);
    const parsed = CivicApiResponseSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected civicAPI response shape");

    for (const item of parsed.data.polls) {
      stats.fetched++;
      const pollParsed = CivicApiPollSchema.safeParse(item);
      if (!pollParsed.success) {
        stats.errors++;
        continue;
      }
      const p = pollParsed.data;

      const answers = (p.answers ?? [])
        .map((a) => CivicApiAnswerSchema.safeParse(a))
        .filter((r): r is { success: true; data: z.infer<typeof CivicApiAnswerSchema> } => r.success)
        .map((r) => ({
          choice: r.data.choice,
          party: r.data.party ?? null,
          percent: parsePercent(r.data.percent),
        }));

      const answersFp = stableAnswersFingerprint(answers);
      const sampleSize = parseSample(p.sample);
      const sourcePollId = fingerprintPoll({
        pollster: p.pollster ?? null,
        start_date: p.start_date ?? null,
        end_date: p.end_date ?? null,
        sample: sampleSize,
        population: p.population ?? null,
        state: p.state ?? null,
        title: p.title ?? null,
        politician: p.politician ?? null,
        type: p.type ?? null,
        answersFp,
      });

      const subject = p.politician ?? p.title ?? null;
      const pollType = p.type ?? "unknown";
      const jurisdiction = p.state ? p.state.toUpperCase() : "US";

      const startDate = p.start_date ? new Date(p.start_date) : null;
      const endDate = p.end_date ? new Date(p.end_date) : null;

      await prisma.poll.upsert({
        where: {
          source_sourcePollId: { source: "civicapi", sourcePollId },
        },
        create: {
          source: "civicapi",
          sourcePollId,
          pollType,
          subject,
          jurisdiction,
          office: null,
          startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
          endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
          sampleSize,
          population: p.population ?? null,
          pollster: p.pollster ?? null,
          sponsor: null,
          methodology: null,
          url: p.url ?? null,
          internal: null,
          partisan: null,
          hypothetical: null,
          raw: item as any,
          answers: { create: answers },
        },
        update: {
          pollType,
          subject,
          jurisdiction,
          startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
          endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
          sampleSize,
          population: p.population ?? null,
          pollster: p.pollster ?? null,
          url: p.url ?? null,
          raw: item as any,
          answers: {
            deleteMany: {},
            create: answers,
          },
        },
      });
      stats.upserted++;
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
