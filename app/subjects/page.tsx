import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { slugifySubject } from "@/lib/utils";
import { Card, Pill } from "@/components/ui";
import { SubjectSearch } from "@/components/SubjectSearch";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const grouped = await prisma.poll.groupBy({
    by: ["subject"],
    where: { subject: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { _all: "desc" } },
  });

  const subjects = grouped
    .filter((g) => !!g.subject)
    .map((g) => {
      const subject = g.subject as string;
      return {
        subject,
        slug: slugifySubject(subject),
        count: g._count._all,
      };
    });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
        <p className="text-sm text-zinc-300">
          Browse topics found in ingested polls. Click a subject to view charts
          and raw poll entries.
        </p>
      </div>

      <SubjectSearch subjects={subjects} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.slice(0, 60).map((s) => (
          <Link key={s.slug} href={`/subject/${s.slug}`}>
            <Card className="transition hover:border-zinc-700">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{s.subject}</div>
                <Pill>{s.count} polls</Pill>
              </div>
              <div className="mt-2 text-xs text-zinc-400">{s.slug}</div>
            </Card>
          </Link>
        ))}
      </div>

      {subjects.length > 60 ? (
        <div className="text-xs text-zinc-400">
          Showing top 60 by poll count. Use search to jump to others.
        </div>
      ) : null}
    </div>
  );
}
