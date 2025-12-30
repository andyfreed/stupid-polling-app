import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  subject: z.string().trim().min(1).optional(),
  pollType: z.string().trim().min(1).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

function parseYmd(s: string) {
  // Interpreted as UTC midnight
  return new Date(`${s}T00:00:00.000Z`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    subject: url.searchParams.get("subject") ?? undefined,
    pollType: url.searchParams.get("pollType") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subject, pollType, from, to } = parsed.data;
  const limit = parsed.data.limit ?? 250;

  const where: Parameters<typeof prisma.poll.findMany>[0]["where"] = {};
  if (subject) where.subject = subject;
  if (pollType) where.pollType = pollType;
  if (from || to) {
    where.endDate = {};
    if (from) where.endDate.gte = parseYmd(from);
    if (to) {
      const endExclusive = parseYmd(to);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      where.endDate.lt = endExclusive;
    }
  }

  const polls = await prisma.poll.findMany({
    where,
    include: { answers: true },
    orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({
    polls: polls.map((p) => ({
      id: p.id,
      source: p.source,
      sourcePollId: p.sourcePollId,
      pollType: p.pollType,
      subject: p.subject,
      jurisdiction: p.jurisdiction,
      office: p.office,
      startDate: p.startDate?.toISOString() ?? null,
      endDate: p.endDate?.toISOString() ?? null,
      sampleSize: p.sampleSize,
      population: p.population,
      pollster: p.pollster,
      sponsor: p.sponsor,
      methodology: p.methodology,
      url: p.url,
      internal: p.internal,
      partisan: p.partisan,
      hypothetical: p.hypothetical,
      answers: p.answers.map((a) => ({
        choice: a.choice,
        party: a.party,
        percent: a.percent,
      })),
    })),
  });
}
