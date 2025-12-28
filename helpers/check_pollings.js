import { Database } from "bun:sqlite";
import path from "path";
import { SUBGRAPHS } from "../src/config.js";

// Configuration
const DATA_DIR = path.resolve(import.meta.dir, "../data");
const DB_PATH = path.join(DATA_DIR, "state.sqlite");
const EXPECTED_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const GAP_THRESHOLD_MS = EXPECTED_INTERVAL_MS * 2.5;

// Parse CLI args for time range
const args = process.argv.slice(2);
let timeWindowMs = 24 * 60 * 60 * 1000; // Default: 24 hours
let limitSamples = null; // No limit by count if time window is used

if (args.includes("--week") || args.includes("-w")) {
  timeWindowMs = 7 * 24 * 60 * 60 * 1000;
  console.log("🕒 Time Window: Last 7 Days");
} else if (args.includes("--month") || args.includes("-m")) {
  timeWindowMs = 30 * 24 * 60 * 60 * 1000;
  console.log("🕒 Time Window: Last 30 Days");
} else if (args.includes("--all") || args.includes("-a")) {
    timeWindowMs = null; // No time limit
    limitSamples = 200; // Default to last 200 if explicitly asked for "all" without time, but user prompt implies time ranges. Let's stick to time ranges or default 200 count if no time arg? 
    // Actually user asked for "last 24 hours last week and last month".
    // Let's make 24h the default if no flag is provided, but allow --count N to override.
} else if (args.includes("--count") || args.includes("-n")) {
  const idx = args.findIndex(a => a === "--count" || a === "-n");
  if (idx !== -1 && args[idx+1]) {
    limitSamples = parseInt(args[idx+1], 10);
    timeWindowMs = null; // Disable time window if count is specified
    console.log(`🔢 Count Limit: Last ${limitSamples} samples`);
  }
} else {
  console.log("🕒 Time Window: Last 24 Hours (Default)");
  console.log("   Use --week, --month, or --count <N> to change.");
}

console.log(`📂 Opening database: ${DB_PATH}`);
const db = new Database(DB_PATH);

// Get list of subgraph names from config
const subgraphNames = SUBGRAPHS.map(s => s.name);
console.log(`ℹ️  Checking ${subgraphNames.length} configured subgraphs...\n`);

const report = {};
const now = Date.now();
const startTime = timeWindowMs ? new Date(now - timeWindowMs).toISOString() : null;

for (const name of subgraphNames) {
  let query;
  let params;

  if (limitSamples) {
    query = `SELECT * FROM samples WHERE name = ? ORDER BY ts DESC LIMIT ?`;
    params = [name, limitSamples];
  } else {
    // Time-based query
    query = `SELECT * FROM samples WHERE name = ? AND ts >= ? ORDER BY ts ASC`; // ASC for time traversal
    params = [name, startTime];
  }

  let samples = db.query(query).all(...params);
  
  // If we used limitSamples (DESC), reverse to get chronological order (ASC)
  if (limitSamples) {
    samples = samples.reverse();
  }

  report[name] = {
    count: samples.length,
    latest: null,
    gaps: [],
    errors: [],
    rotations: 0,
    startTime: samples.length > 0 ? samples[0].ts : null,
    endTime: samples.length > 0 ? samples[samples.length - 1].ts : null
  };

  if (samples.length === 0) {
    continue;
  }

  report[name].latest = samples[samples.length - 1];
  
  let prevTs = null;
  let prevIndexer = null;

  samples.forEach((s) => {
    const ts = new Date(s.ts).getTime();

    // Check for gaps
    if (prevTs) {
      const diff = ts - prevTs;
      if (diff > GAP_THRESHOLD_MS) {
        report[name].gaps.push({
          from: new Date(prevTs).toISOString(),
          to: s.ts,
          durationMin: Math.round(diff / 60000)
        });
      }
    }
    prevTs = ts;

    // Check for rotations
    if (s.indexer && prevIndexer && s.indexer !== prevIndexer) {
      report[name].rotations++;
    }
    if (s.indexer) prevIndexer = s.indexer;

    // Check for value errors
    if (s.value === null || s.value === undefined) {
      report[name].errors.push(`Null value at ${s.ts}`);
    }

    // Check payload errors
    if (s.payload) {
      try {
        const p = JSON.parse(s.payload);
        if (p.errors || p.error) {
           report[name].errors.push(`Payload error at ${s.ts}`);
        }
      } catch (e) {}
    }
  });
}

// Print Report
console.log("--- POLLINGS REPORT ---\n");

for (const name of subgraphNames) {
  const r = report[name];
  
  if (r.count === 0) {
    console.log(`⚪ [${name}]`);
    console.log(`   No samples found in the selected period.`);
    console.log("");
    continue;
  }

  const statusIcon = (r.errors.length > 0 || r.gaps.length > 0) ? "⚠️ " : "✅";
  console.log(`${statusIcon} [${name}]`);
  console.log(`   Samples: ${r.count}`);
  console.log(`   Period:  ${r.startTime} -> ${r.endTime}`);
  console.log(`   Latest Value: ${r.latest?.value ?? "N/A"}`);

  if (r.rotations > 0) {
    console.log(`   🔄 Rotations: ${r.rotations}`);
  }

  if (r.gaps.length > 0) {
    console.log(`   📉 Gaps detected: ${r.gaps.length}`);
    r.gaps.slice(0, 3).forEach(g => 
      console.log(`      - ${g.durationMin}m gap (${g.from} -> ${g.to})`)
    );
    if (r.gaps.length > 3) console.log(`      ... ${r.gaps.length - 3} more`);
  }

  if (r.errors.length > 0) {
    console.log(`   ❌ Errors: ${r.errors.length}`);
    r.errors.slice(0, 3).forEach(e => console.log(`      - ${e}`));
  }
  
  console.log("");
}
