import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  subject: z.string().trim().min(1),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function parseYmd(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getPct(answers: Array<{ choice: string; percent: number | null }>, key: string) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const found = answers.find((a) => norm(a.choice) === key);
  return typeof found?.percent === "number" ? found.percent : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    subject: url.searchParams.get("subject") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subject, from, to } = parsed.data;

  const where: Parameters<typeof prisma.poll.findMany>[0]["where"] = {
    subject,
    pollType: { contains: "approval", mode: "insensitive" },
  };

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
    orderBy: [{ endDate: "asc" }],
    take: 2000,
  });

  type Agg = {
    date: string;
    approveSum: number;
    disapproveSum: number;
    count: number;
    wApproveSum: number;
    wDisapproveSum: number;
    w: number;
  };

  const byDay = new Map<string, Agg>();

  for (const p of polls) {
    if (!p.endDate) continue;
    const date = dayKey(p.endDate);
    const approve = getPct(p.answers, "approve");
    const disapprove = getPct(p.answers, "disapprove");
    if (typeof approve !== "number" || typeof disapprove !== "number") continue;

    const weight = typeof p.sampleSize === "number" && p.sampleSize > 0 ? p.sampleSize : 0;
    const existing =
      byDay.get(date) ??
      ({
        date,
        approveSum: 0,
        disapproveSum: 0,
        count: 0,
        wApproveSum: 0,
        wDisapproveSum: 0,
        w: 0,
      } satisfies Agg);

    byDay.set(date, {
      ...existing,
      approveSum: existing.approveSum + approve,
      disapproveSum: existing.disapproveSum + disapprove,
      count: existing.count + 1,
      wApproveSum: existing.wApproveSum + approve * weight,
      wDisapproveSum: existing.wDisapproveSum + disapprove * weight,
      w: existing.w + weight,
    });
  }

  const series = Array.from(byDay.values())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => {
      const approve = d.count ? d.approveSum / d.count : null;
      const disapprove = d.count ? d.disapproveSum / d.count : null;
      const net =
        typeof approve === "number" && typeof disapprove === "number"
          ? approve - disapprove
          : null;

      const wApprove = d.w > 0 ? d.wApproveSum / d.w : null;
      const wDisapprove = d.w > 0 ? d.wDisapproveSum / d.w : null;
      const sampleWeightedNet =
        typeof wApprove === "number" && typeof wDisapprove === "number"
          ? wApprove - wDisapprove
          : null;

      return {
        date: d.date,
        approve,
        disapprove,
        net,
        sampleWeightedNet,
        n: d.count,
      };
    });

  return NextResponse.json({ subject, series });
}
