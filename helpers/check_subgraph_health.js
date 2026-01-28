import { loadEndpoints, getAll } from "../src/endpoints.js";
import { checkSync, formatLag } from "../src/sync.js";
import { SYNC_LAG_THRESHOLD } from "../src/config.js";

// Load endpoints from endpoints.json (or migrate defaults on first run)
loadEndpoints();
const ENDPOINTS = getAll();

console.log(`🏥 Checking sync status of ${ENDPOINTS.length} endpoints...\n`);
console.log(`   Lag threshold: ${SYNC_LAG_THRESHOLD} blocks\n`);

async function run() {
  const results = await Promise.all(ENDPOINTS.map(checkSync));

  let ok = 0;
  let lagging = 0;
  let errors = 0;
  let fetchFail = 0;

  for (const r of results) {
    if (r.error) {
      console.log(`❌ [${r.name}] Error: ${r.error}`);
      fetchFail++;
      continue;
    }

    const lagStr = r.lag !== null ? formatLag(r.lag) : "n/a";
    const isLagging = r.lag !== null && r.lag > SYNC_LAG_THRESHOLD;

    if (isLagging) {
      console.log(`🔴 [${r.name}] Lagging ${lagStr} blocks (chain: ${r.chainHead}, subgraph: ${r.subgraphBlock})`);
      lagging++;
    } else if (r.hasIndexingErrors) {
      console.log(`⚠️  [${r.name}] Indexing errors (lag: ${lagStr})`);
      errors++;
    } else {
      console.log(`🟢 [${r.name}] OK (lag: ${lagStr})`);
      ok++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`🟢 OK: ${ok}`);
  console.log(`🔴 Lagging: ${lagging}`);
  console.log(`⚠️  Indexing errors: ${errors}`);
  console.log(`❌ Fetch failures: ${fetchFail}`);
}

run();
