import {
  FEES_QUERY,
  FEES_SUBGRAPH_ID,
  SUBGRAPHS,
  UPTIME_KUMA_PUSH_URL,
  UPTIME_KUMA_INTERVAL_MS,
  ALERT_SEND_INTERVAL_MS,
} from "./config.js";
import { fetchSubgraph, gatewayUrl, resolveUrl } from "./graph.js";
import { resolveIndexer } from "./attestation.js";
import { feeAlerts, kpiAlerts, kpiValue, formatInt, formatPct } from "./alerts.js";
import { store, pushHistory, getSubs } from "./store.js";
import { logger } from "./logger.js";
import { recordSample, getSummaries } from "./analysis.js";
import { recordSampleHistory } from "./history.js";

const nowIso = () => new Date().toISOString();

let lock = Promise.resolve();
const withLock = (fn) => {
  const next = lock.then(fn);
  lock = next.catch(() => { });
  return next;
};

async function handleFees() {
  const url = gatewayUrl(FEES_SUBGRAPH_ID);
  const res = await fetchSubgraph(url, FEES_QUERY);
  if (res.error) return [`Fees fetch failed: ${res.error}`];
  const current = res.data?.global;
  if (!current) return ["Fees data missing"];
  const prev = (await store.get("fees:last")) || null;
  const indexerInfo = await resolveIndexer(res.attestation);
  const indexerId = indexerInfo?.indexer || indexerInfo?.allocationId || null;
  const alerts = feeAlerts(current, prev?.global, indexerId, prev?.indexer);
  await store.set("fees:last", {
    global: current,
    indexer: indexerId,
    indexerName: indexerInfo?.name || null,
    ts: nowIso(),
  });
  recordSampleHistory({
    ts: nowIso(),
    name: "Legacy Fees",
    type: "FEES",
    value: Number(current.totalFeesIn ?? 0),
    indexer: indexerId,
    indexerName: indexerInfo?.name || null,
    payload: current,
  });
  return alerts;
}

async function handleSubgraph(entry) {
  const url = resolveUrl(entry);
  if (!url) return { alerts: [`${entry.name}: URL missing`] };
  const res = await fetchSubgraph(url, entry.query);
  if (res.error) return { alerts: [`${entry.name}: fetch failed (${res.error})`] };
  const value = kpiValue(res.data, entry.type);
  if (!Number.isFinite(value)) return { alerts: [`${entry.name}: invalid data`] };
  const prev = (await store.get(`kpi:last:${entry.name}`)) || null;
  const indexerInfo = await resolveIndexer(res.attestation);
  const indexerId = indexerInfo?.indexer || indexerInfo?.allocationId || null;
  const alerts = kpiAlerts(entry.name, value, prev?.value, indexerId, prev?.indexer);
  const sample = {
    value,
    indexer: indexerId,
    indexerName: indexerInfo?.name || null,
    ts: nowIso(),
  };
  await store.set(`kpi:last:${entry.name}`, sample);
  await recordSample(entry.name, sample);
  recordSampleHistory({
    ts: sample.ts,
    name: entry.name,
    type: entry.type,
    value,
    indexer: indexerId,
    indexerName: indexerInfo?.name || null,
    payload: res.data,
  });
  return { value, alerts };
}

async function handleKpis() {
  const alerts = [];
  let totalAta = 0;
  let totalRegistry = 0;
  for (const sg of SUBGRAPHS) {
    const res = await handleSubgraph(sg);
    if (res.value !== undefined) {
      if (sg.type === "ATA") totalAta += res.value;
      else totalRegistry += res.value;
    }
    alerts.push(...res.alerts);
  }
  await store.set("kpi:totals", {
    totalAta,
    totalTransactions: totalRegistry,
    totalRegistry,
    ts: nowIso(),
  });
  return alerts;
}

async function queueAlerts(messages) {
  if (!messages.length) return;
  await withLock(async () => {
    const pending = (await store.get("pending:alerts")) || [];
    await store.set("pending:alerts", [...pending, ...messages]);
  });
}

async function flushAlerts(bot, force = false) {
  await withLock(async () => {
    const last = (await store.get("alerts:lastPush")) || 0;
    const now = Date.now();
    if (!force && now - last < ALERT_SEND_INTERVAL_MS) return;
    const pending = (await store.get("pending:alerts")) || [];
    if (!pending.length) return;
    const subs = await getSubs();
    if (!subs.length) return;
    const detailText = pending.map((m) => `• ${m}`).join("\n");
    let rotations = 0;
    let drops = 0;
    let analyses = 0;
    const lastCounts = (await store.get("alerts:lastCounts")) || { rotations: 0, drops: 0, analyses: 0 };
    const rotationSamples = [];
    for (const msg of pending) {
      const lower = msg.toLowerCase();
      if (lower.includes("indexer rotated")) {
        rotations += 1;
        if (rotationSamples.length < 3) rotationSamples.push(msg);
      }
      if (lower.includes("fell") || lower.includes("↓")) drops += 1;
      if (msg.startsWith("Analysis ")) analyses += 1;
    }
    const samples = rotationSamples.length
      ? rotationSamples.slice(0, 2).map((m) => `• ${m.slice(0, 140)}`)
      : [];
    const deltaRotations = rotations - (lastCounts.rotations || 0);
    const summary =
      pending.length > 5
        ? `${pending.length} events. Indexer changes: ${rotations} (Δ ${deltaRotations >= 0 ? "+" : ""}${deltaRotations}), Drops: ${drops}, Analysis: ${analyses}.` +
        (samples.length ? `\nIndexer changes (examples):\n${samples.join("\n")}` : "") +
        `\nTap "View report" for details.`
        : detailText;
    const reportId = `rep-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const reply_markup =
      pending.length > 5
        ? { inline_keyboard: [[{ text: "View report", callback_data: `report:${reportId}` }]] }
        : undefined;
    const hasDrops = drops > 0;
    if (hasDrops) {
      await Promise.all(
        subs.map((chatId) =>
          bot.api
            .sendMessage(chatId, summary, { parse_mode: "Markdown", reply_markup: reply_markup })
            .catch((err) => logger.error({ msg: "Send failed", chatId, error: err.message }))
        )
      );
      await store.set(`report:${reportId}`, detailText);
      await store.set("last:report", detailText);
      await store.set("last:report:id", reportId);
      const recent = (await store.get("reports:recent")) || [];
      const nextRecent = [reportId, ...recent].slice(0, 20);
      await store.set("reports:recent", nextRecent);
    }
    await Promise.all(pending.map((m) => pushHistory(m)));
    logger.info({ type: "alert", messages: pending });
    await store.set("pending:alerts", []);
    await store.set("alerts:lastPush", now);
    await store.set("alerts:lastCounts", { rotations, drops, analyses });
  });
}

async function heartbeat() {
  if (!UPTIME_KUMA_PUSH_URL) return;
  try {
    await fetch(UPTIME_KUMA_PUSH_URL);
    logger.info({ type: "heartbeat", status: "ok" });
  } catch (err) {
    logger.error({ msg: "Heartbeat failed", error: err.message });
    logger.info({ type: "heartbeat", status: "fail", error: err.message });
  }
}

const buildPoll = (bot) => async () => {
  const alerts = [];
  alerts.push(...(await handleFees()));
  alerts.push(...(await handleKpis()));
  const dropsInBatch = alerts.reduce(
    (acc, msg) => acc + (msg.toLowerCase().includes("fell") || msg.includes("↓") ? 1 : 0),
    0
  );
  await queueAlerts(alerts);
  const pending = ((await store.get("pending:alerts")) || []).length;
  logger.info({ type: "poll", alertsCount: alerts.length, dropsInBatch, pending });
  const summaries = await getSummaries();
  if (summaries.length) {
    const messages = summaries.map(
      (s) =>
        `Analysis ${s.name}: ${s.rotations} indexer changes over ${s.samples} samples; ` +
        `${s.distinctIndexers} indexers; range ${formatInt(s.min)} → ${formatInt(s.max)} ` +
        `(Δ ${formatInt(s.spread)}, ${formatPct(s.pct)}); latest ${s.latestIndexer || "n/a"}`
    );
    await queueAlerts(messages);
  }
  await flushAlerts(bot);
  await heartbeat();
};

const startHeartbeat = () => {
  if (!UPTIME_KUMA_PUSH_URL) return;
  heartbeat();
  setInterval(heartbeat, UPTIME_KUMA_INTERVAL_MS);
};

export { buildPoll, startHeartbeat, flushAlerts };

