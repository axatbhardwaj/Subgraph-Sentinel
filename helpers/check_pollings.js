import path from "path";
import Keyv from "keyv";
import SQLite from "@keyv/sqlite";
import { loadEndpoints, getAll } from "../src/endpoints.js";
import { formatLag } from "../src/sync.js";
import { SYNC_LAG_THRESHOLD } from "../src/config.js";

// Load endpoints from endpoints.json (or migrate defaults on first run)
loadEndpoints();

const DATA_DIR = path.resolve(import.meta.dir, "../data");
const store = new Keyv({ store: new SQLite({ uri: `sqlite://${path.join(DATA_DIR, "state.sqlite")}` }) });

const endpoints = getAll();
console.log(`📊 Checking sync state for ${endpoints.length} configured endpoints...\n`);
console.log(`   Lag threshold: ${SYNC_LAG_THRESHOLD} blocks\n`);

async function run() {
  const report = {
    ok: [],
    lagging: [],
    indexingErrors: [],
    fetchFail: [],
    unknown: [],
  };

  for (const ep of endpoints) {
    const state = await store.get(`sync:alert:${ep.name}`);

    if (!state) {
      report.unknown.push({ name: ep.name, chain: ep.chain });
      continue;
    }

    const lagStr = state.lastLag !== null && state.lastLag !== undefined
      ? formatLag(state.lastLag)
      : "n/a";

    const entry = {
      name: ep.name,
      chain: ep.chain,
      lag: state.lastLag,
      lagStr,
      lastCheck: state.lastCheck,
    };

    if (state.fetchFail) {
      report.fetchFail.push(entry);
    } else if (state.lagAlert) {
      report.lagging.push(entry);
    } else if (state.errorAlert) {
      report.indexingErrors.push(entry);
    } else {
      report.ok.push(entry);
    }
  }

  // Print Report
  console.log("--- SYNC STATE REPORT ---\n");

  if (report.ok.length > 0) {
    console.log(`🟢 OK (${report.ok.length}):`);
    for (const e of report.ok) {
      console.log(`   ${e.name} (${e.chain}) - lag: ${e.lagStr}`);
    }
    console.log("");
  }

  if (report.lagging.length > 0) {
    console.log(`🔴 LAGGING (${report.lagging.length}):`);
    for (const e of report.lagging) {
      console.log(`   ${e.name} (${e.chain}) - lag: ${e.lagStr}`);
    }
    console.log("");
  }

  if (report.indexingErrors.length > 0) {
    console.log(`⚠️  INDEXING ERRORS (${report.indexingErrors.length}):`);
    for (const e of report.indexingErrors) {
      console.log(`   ${e.name} (${e.chain}) - lag: ${e.lagStr}`);
    }
    console.log("");
  }

  if (report.fetchFail.length > 0) {
    console.log(`❌ FETCH FAILURES (${report.fetchFail.length}):`);
    for (const e of report.fetchFail) {
      console.log(`   ${e.name} (${e.chain})`);
    }
    console.log("");
  }

  if (report.unknown.length > 0) {
    console.log(`⚪ NO DATA (${report.unknown.length}):`);
    for (const e of report.unknown) {
      console.log(`   ${e.name} (${e.chain}) - not yet checked`);
    }
    console.log("");
  }

  console.log("--- Summary ---");
  console.log(`🟢 OK: ${report.ok.length}`);
  console.log(`🔴 Lagging: ${report.lagging.length}`);
  console.log(`⚠️  Indexing errors: ${report.indexingErrors.length}`);
  console.log(`❌ Fetch failures: ${report.fetchFail.length}`);
  console.log(`⚪ Unknown: ${report.unknown.length}`);
}

run();
