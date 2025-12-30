import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugifySubject } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const limit = parsed.data.limit ?? 200;

  const grouped = await prisma.poll.groupBy({
    by: ["subject", "pollType"],
    where: { subject: { not: null } },
    _count: { _all: true },
    _max: { endDate: true },
    orderBy: [{ _count: { _all: "desc" } }],
    take: 2000,
  });

  const map = new Map<
    string,
    {
      subject: string;
      slug: string;
      count: number;
      pollTypes: Set<string>;
      latestEndDate: string | null;
    }
  >();

  for (const g of grouped) {
    const subject = g.subject as string;
    const existing =
      map.get(subject) ??
      ({
        subject,
        slug: slugifySubject(subject),
        count: 0,
        pollTypes: new Set<string>(),
        latestEndDate: null,
      } as const);

    const latest = g._max.endDate ? g._max.endDate.toISOString() : null;
    const bestLatest =
      !existing.latestEndDate || (latest && latest > existing.latestEndDate)
        ? latest
        : existing.latestEndDate;

    map.set(subject, {
      ...existing,
      count: existing.count + g._count._all,
      pollTypes: new Set([...existing.pollTypes, g.pollType]),
      latestEndDate: bestLatest,
    });
  }

  const subjects = Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((s) => ({
      subject: s.subject,
      slug: s.slug,
      count: s.count,
      pollTypes: Array.from(s.pollTypes).sort(),
      latestEndDate: s.latestEndDate,
    }));

  return NextResponse.json({ subjects });
}
