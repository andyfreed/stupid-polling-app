"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Pill } from "@/components/ui";

type SubjectRow = {
  subject: string;
  slug: string;
  count: number;
};

export function SubjectSearch({ subjects }: { subjects: SubjectRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return subjects.slice(0, 12);
    return subjects
      .filter(
        (s) =>
          s.subject.toLowerCase().includes(query) || s.slug.includes(query),
      )
      .slice(0, 24);
  }, [q, subjects]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm text-zinc-300" htmlFor="subject-search">
          Search
        </label>
        <input
          id="subject-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Donald Trump, generic ballot"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none sm:max-w-md"
        />
      </div>

      {q.trim() ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
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
          {filtered.length === 0 ? (
            <div className="text-sm text-zinc-400">No matches.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
