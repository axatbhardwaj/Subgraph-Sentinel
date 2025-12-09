import { SUBGRAPHS, ANALYSIS_HISTORY } from "./config.js";
import { store } from "./store.js";

async function getHistory(name) {
  return (await store.get(`analysis:${name}`)) || [];
}

async function recordSample(name, sample) {
  const history = await getHistory(name);
  history.push(sample);
  if (history.length > ANALYSIS_HISTORY) history.shift();
  await store.set(`analysis:${name}`, history);
}

function summarizeHistory(name, history) {
  if (history.length < 2) return null;
  const indexers = new Set(history.map((h) => h.indexer || "unknown"));
  if (indexers.size <= 1) return null;
  const values = history.map((h) => Number(h.value ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  let drops = 0;
  let rotations = 0;
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1].indexer || "unknown";
    const curr = history[i].indexer || "unknown";
    if (prev !== curr) rotations += 1;
    const prevVal = Number(history[i - 1].value ?? 0);
    const currVal = Number(history[i].value ?? 0);
    if (currVal < prevVal) drops += 1;
  }
  if (drops === 0 && rotations === 0 && spread === 0) return null;
  const latest = history[history.length - 1];
  return {
    name,
    distinctIndexers: indexers.size,
    indexers: Array.from(indexers).slice(0, 3),
    min,
    max,
    spread,
    pct: max ? spread / max : 0,
    latestIndexer: latest.indexer,
    latestValue: latest.value,
    rotations,
    samples: history.length,
    drops,
  };
}

async function getSummaries() {
  const results = [];
  for (const sg of SUBGRAPHS) {
    const history = await getHistory(sg.name);
    const summary = summarizeHistory(sg.name, history);
    if (summary) results.push(summary);
  }
  return results;
}

export { recordSample, getSummaries };

