import crypto from "node:crypto";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && "name" in v && typeof (v as any).name === "string") {
    return (v as any).name;
  }
  return null;
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function fetchJsonWithRetry<T>(
  url: string,
  opts?: {
    method?: "GET";
    headers?: Record<string, string>;
    retries?: number;
    timeoutMs?: number;
    minDelayMs?: number;
    maxDelayMs?: number;
  },
): Promise<T> {
  const retries = opts?.retries ?? 4;
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const minDelayMs = opts?.minDelayMs ?? 350;
  const maxDelayMs = opts?.maxDelayMs ?? 4_000;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts?.method ?? "GET",
        headers: opts?.headers,
        signal: ac.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
      }
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
      const base = Math.min(maxDelayMs, minDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(base + jitter);
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

export function createRateLimiter(maxPerMinute: number) {
  const minIntervalMs = Math.ceil(60_000 / maxPerMinute);
  let lastAt = 0;

  return async function rateLimit() {
    const now = Date.now();
    const wait = lastAt + minIntervalMs - now;
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
  };
}
