type Point = { date: string; value: number | null };

function toPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return `M ${points[0]!.x} ${points[0]!.y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

export function SimpleLineChart({
  points,
  height = 140,
}: {
  points: Point[];
  height?: number;
}) {
  const usable = points
    .map((p, i) => ({ ...p, i }))
    .filter((p) => typeof p.value === "number") as Array<
    Point & { i: number; value: number }
  >;

  if (usable.length < 2) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
        Not enough data to chart yet.
      </div>
    );
  }

  const values = usable.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const w = 800;
  const h = height;
  const padX = 18;
  const padY = 18;

  const span = max - min || 1;
  const coords = usable.map((p) => {
    const x =
      padX +
      (p.i / Math.max(1, usable[usable.length - 1]!.i)) * (w - 2 * padX);
    const y = padY + (1 - (p.value - min) / span) * (h - 2 * padY);
    return { x, y, value: p.value, date: p.date };
  });

  const path = toPath(coords);
  const last = coords[coords.length - 1]!;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div className="text-sm text-zinc-300">Daily net (approve − disapprove)</div>
        <div className="text-sm font-medium text-zinc-50">
          Latest: {last.value.toFixed(1)}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        <defs>
          <linearGradient id="lineFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={path} fill="none" stroke="rgb(34 211 238)" strokeWidth="3" />

        <circle
          cx={last.x}
          cy={last.y}
          r="5"
          fill="rgb(34 211 238)"
          stroke="rgb(9 9 11)"
          strokeWidth="2"
        />
      </svg>
      <div className="mt-2 text-xs text-zinc-500">
        Range: {min.toFixed(1)} to {max.toFixed(1)}
      </div>
    </div>
  );
}
