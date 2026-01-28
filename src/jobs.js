import {
  UPTIME_KUMA_PUSH_URL,
  UPTIME_KUMA_INTERVAL_MS,
  ALERT_SEND_INTERVAL_MS,
  POLL_CONCURRENCY,
} from "./config.js";
import { getAll } from "./endpoints.js";
import { runSyncChecks } from "./sync.js";
import { store, pushHistory, getSubs } from "./store.js";
import { logger } from "./logger.js";

const nowIso = () => new Date().toISOString();

let lock = Promise.resolve();
const withLock = (fn) => {
  const next = lock.then(fn);
  lock = next.catch(() => {});
  return next;
};

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
    const summary = pending.length > 5
      ? `${pending.length} sync events.\n${pending.slice(0, 3).map((m) => `• ${m}`).join("\n")}\n...and ${pending.length - 3} more. Tap "View report" for details.`
      : detailText;

    const reportId = `rep-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const reply_markup = pending.length > 5
      ? { inline_keyboard: [[{ text: "View report", callback_data: `report:${reportId}` }]] }
      : undefined;

    await Promise.all(
      subs.map((chatId) =>
        bot.api
          .sendMessage(chatId, summary, { parse_mode: "Markdown", reply_markup })
          .catch((err) => logger.error({ msg: "Send failed", chatId, error: err.message }))
      )
    );

    await store.set(`report:${reportId}`, detailText);
    await store.set("last:report", detailText);
    await store.set("last:report:id", reportId);

    const recent = (await store.get("reports:recent")) || [];
    const nextRecent = [reportId, ...recent].slice(0, 20);
    await store.set("reports:recent", nextRecent);

    await Promise.all(pending.map((m) => pushHistory(m)));
    logger.info({ type: "alert", messages: pending });

    await store.set("pending:alerts", []);
    await store.set("alerts:lastPush", now);
  });
}

async function heartbeat() {
  if (!UPTIME_KUMA_PUSH_URL) return;
  try {
    await fetch(UPTIME_KUMA_PUSH_URL);
    logger.info({ type: "heartbeat", status: "ok" });
  } catch (err) {
    logger.error({ msg: "Heartbeat failed", error: err.message });
  }
}

const buildPoll = (bot) => async () => {
  const endpoints = getAll();
  const { results, alerts } = await runSyncChecks(endpoints, POLL_CONCURRENCY);

  // Count stats
  let ok = 0;
  let lagging = 0;
  let errors = 0;
  let fetchFail = 0;

  for (const r of results) {
    if (r.error) {
      fetchFail++;
    } else if (r.lag !== null && r.lag > 100) {
      lagging++;
    } else if (r.hasIndexingErrors) {
      errors++;
    } else {
      ok++;
    }
  }

  await queueAlerts(alerts);
  const pending = ((await store.get("pending:alerts")) || []).length;
  logger.info({ type: "poll", endpoints: endpoints.length, ok, lagging, errors, fetchFail, alertsGenerated: alerts.length, pending });

  await flushAlerts(bot);
  await heartbeat();
};

const startHeartbeat = () => {
  if (!UPTIME_KUMA_PUSH_URL) return;
  heartbeat();
  setInterval(heartbeat, UPTIME_KUMA_INTERVAL_MS);
};

export { buildPoll, startHeartbeat, flushAlerts };
