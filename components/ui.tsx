import type React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Pill({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200",
        className,
      )}
      {...props}
    />
  );
}
