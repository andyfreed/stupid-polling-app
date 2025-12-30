import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugifySubject, titleFromSlug } from "@/lib/utils";
import { Card, Pill } from "@/components/ui";
import { SimpleLineChart } from "@/components/SimpleLineChart";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function getApprovalNet(answers: Array<{ choice: string; percent: number | null }>) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const approve = answers.find((a) => norm(a.choice) === "approve")?.percent ?? null;
  const disapprove =
    answers.find((a) => norm(a.choice) === "disapprove")?.percent ?? null;
  if (typeof approve !== "number" || typeof disapprove !== "number") return null;
  return approve - disapprove;
}

export default async function SubjectDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug;

  // Resolve slug -> canonical subject in DB
  const subjects = await prisma.poll.groupBy({
    by: ["subject"],
    where: { subject: { not: null } },
  });

  const matched = subjects
    .map((s) => s.subject as string)
    .find((s) => slugifySubject(s) === slug);

  if (!matched) notFound();

  const endAfter = new Date();
  endAfter.setDate(endAfter.getDate() - 90);

  const polls = await prisma.poll.findMany({
    where: {
      subject: matched,
      endDate: { gte: endAfter },
    },
    include: { answers: true },
    orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const approvalSeries = polls
    .slice()
    .reverse()
    .map((p) => ({
      date: p.endDate ? formatDate(p.endDate) : "",
      value: getApprovalNet(
        p.answers.map((a) => ({ choice: a.choice, percent: a.percent })),
      ),
    }))
    .filter((p) => p.date);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-zinc-400">
          <Link className="underline underline-offset-2 hover:text-white" href="/subjects">
            Subjects
          </Link>{" "}
          / <span className="text-zinc-300">{slug}</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{matched}</h1>
            <div className="mt-1 text-sm text-zinc-300">
              Last 90 days · up to 200 most recent polls
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>{polls.length} polls</Pill>
            <Pill>Slug: {slug}</Pill>
          </div>
        </div>
      </div>

      <SimpleLineChart points={approvalSeries} />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-950/95 text-left text-xs text-zinc-400">
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Pollster</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Sample</th>
              <th className="px-4 py-3">Pop</th>
              <th className="px-4 py-3">Net (A-D)</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {polls.map((p) => {
              const net = getApprovalNet(
                p.answers.map((a) => ({ choice: a.choice, percent: a.percent })),
              );
              return (
                <tr key={p.id} className="hover:bg-zinc-950">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                    {formatDate(p.endDate)}
                  </td>
                  <td className="px-4 py-3">{p.pollster ?? "—"}</td>
                  <td className="px-4 py-3">{p.pollType}</td>
                  <td className="px-4 py-3">{p.sampleSize ?? "—"}</td>
                  <td className="px-4 py-3">{p.population ?? "—"}</td>
                  <td className="px-4 py-3">
                    {typeof net === "number" ? net.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3">{p.source}</td>
                  <td className="px-4 py-3">
                    {p.url ? (
                      <a
                        className="underline underline-offset-2 hover:text-white"
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        source
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {polls.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-400" colSpan={8}>
                  No polls found for this subject in the last 90 days. Try running{" "}
                  <span className="font-mono">pnpm ingest</span>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <div className="text-xs text-zinc-500">
        If you expected a specific name, remember slugs are normalized. (Example:
        {` `}"{titleFromSlug(slug)}")
      </div>
    </div>
  );
}
