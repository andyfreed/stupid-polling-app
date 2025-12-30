import { ingestVoteHub } from "./votehub";
import { ingestCivicApi } from "./civicapi";

async function main() {
  const started = Date.now();
  const results: Record<string, unknown> = {};

  console.log("[ingest] starting…");

  try {
    results.votehub = await ingestVoteHub();
    console.log("[ingest] votehub done", results.votehub);
  } catch (e) {
    console.error("[ingest] votehub failed", e);
  }

  try {
    results.civicapi = await ingestCivicApi();
    console.log("[ingest] civicapi done", results.civicapi);
  } catch (e) {
    console.error("[ingest] civicapi failed", e);
  }

  const ms = Date.now() - started;
  console.log(`[ingest] finished in ${ms}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
