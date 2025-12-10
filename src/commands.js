import { formatEth, formatInt, formatPct } from "./alerts.js";
import { store, getHistory, getSubs, saveSubs } from "./store.js";
import { InputFile } from "grammy";
import { getSummaries } from "./analysis.js";

function registerCommands(bot) {
  bot.command("start", async (ctx) => {
    const subs = await getSubs();
    if (!subs.includes(ctx.chat.id)) {
      subs.push(ctx.chat.id);
      await saveSubs(subs);
    }
    await ctx.reply("Subscribed to subgraph alerts. Use /mute to stop.");
  });

  bot.command("mute", async (ctx) => {
    const subs = await getSubs();
    const next = subs.filter((id) => id !== ctx.chat.id);
    await saveSubs(next);
    await ctx.reply("Muted. Use /start to subscribe again.");
  });

  bot.command("status", async (ctx) => {
    const fees = (await store.get("fees:last")) || {};
    const totals = (await store.get("kpi:totals")) || {};
    const feeLine = fees.global
      ? `Fees: ${formatEth(fees.global.totalFeesIn)} (legacy ${formatEth(
          fees.global.totalFeesInLegacyMech
        )}, market ${formatEth(fees.global.totalFeesInLegacyMechMarketPlace)})`
      : "Fees: n/a";
    const ataLine = `ATA: ${formatInt(totals.totalAta ?? 0)}`;
    const txLine = `Total transactions: ${formatInt(
      totals.totalTransactions ?? totals.totalRegistry ?? 0
    )}`;
    await ctx.reply([feeLine, ataLine, txLine].join("\n"));
  });

  bot.command("history", async (ctx) => {
    const history = await getHistory();
    if (!history.length) {
      await ctx.reply("No alerts recorded yet.");
      return;
    }
    const lines = history.slice(-10).map((h) => {
      const t = new Date(h.ts);
      const hh = `${t.getHours()}`.padStart(2, "0");
      const mm = `${t.getMinutes()}`.padStart(2, "0");
      return `${hh}:${mm} • ${h.message}`;
    });
    await ctx.reply(lines.join("\n"));
  });

  bot.command("alerts", async (ctx) => {
    const subs = await getSubs();
    const on = subs.includes(ctx.chat.id);
    await ctx.reply(
      on
        ? "Alerts are ON for this chat. Signals: fee drops, KPI drops, indexer rotations, fetch failures."
        : "Alerts are OFF. Use /start to subscribe."
    );
  });

  bot.command("report", async (ctx) => {
    const parts = (ctx.message?.text || "").trim().split(/\s+/);
    const requestedId = parts.length > 1 ? parts[1] : null;
    let reportId = requestedId || (await store.get("last:report:id"));
    if (!reportId) {
      const recent = (await store.get("reports:recent")) || [];
      reportId = recent[0];
    }
    if (!reportId) {
      await ctx.reply("No report available.");
      return;
    }
    const report = await store.get(`report:${reportId}`);
    if (!report) {
      await ctx.reply("Report not found.");
      return;
    }
    const filename = `report-${reportId}.md`;
    const file = new InputFile(Buffer.from(report, "utf-8"), filename);
    await ctx.replyWithDocument(file).catch((err) => console.error("Send document failed", err.message));
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "/start - subscribe to alerts",
        "/mute - stop alerts",
        "/status - latest totals",
        "/history - recent alerts",
        "/analyze - recent indexer inconsistencies",
        "/report - last detailed alert batch",
        "/explain - what the bot monitors and how alerts work",
        "/alerts - subscription status",
        "/help - this message",
      ].join("\n")
    );
  });

  bot.command("explain", async (ctx) => {
    await ctx.reply(
      [
        "Subgraph Sentinel monitors The Graph subgraphs for:",
        "- Fee regressions (legacy fees) on the legacy fees subgraph.",
        "- New mech marketplace fee subgraphs (Gnosis/Base) for USD fee totals.",
        "- KPI drops and indexer rotations on ATA Transactions and Total Transactions in registry subgraphs.",
        "",
        "Polling & alerts:",
        "- Polls every 5 minutes.",
        "- Only sends Telegram when drops are detected (since all of the above metrics should always increase); batches include a summary and a 'View report' button.",
        "- Reports are stored with unique IDs; use /report <id> or tap the button to fetch the detail (.md).",
        "",
        "Analysis:",
        "- Keeps a short recent window per subgraph; flags rotations, drops, and value spread across indexers.",
        "- /analyze shows recent inconsistencies per subgraph (indexer count, range, delta).",
        "",
        "Data:",
        "- State and history stored in SQLite at data/state.sqlite (samples table plus bot state).",
      ].join("\n")
    );
  });

  bot.command("analyze", async (ctx) => {
    const summaries = await getSummaries();
    if (!summaries.length) {
      await ctx.reply("No multi-indexer inconsistencies detected in the recent window.");
      return;
    }
    const lines = summaries.map(
      (s) =>
        `${s.name}: ${s.distinctIndexers} indexers, range ${formatInt(s.min)} → ${formatInt(
          s.max
        )} (Δ ${formatInt(s.spread)}, ${formatPct(s.pct)}), latest ${s.latestIndexer || "n/a"}`
    );
    await ctx.reply(lines.join("\n"));
  });

  bot.callbackQuery("report", async (ctx) => {
    const data = ctx.callbackQuery.data || "";
    const id = data.includes(":") ? data.split(":")[1] : null;
    const reportId = id || (await store.get("last:report:id"));
    if (!reportId) {
      await ctx.answerCallbackQuery({ text: "No recent report", show_alert: false });
      return;
    }
    const report = await store.get(`report:${reportId}`);
    if (!report) {
      await ctx.answerCallbackQuery({ text: "No recent report", show_alert: false });
      return;
    }
    await ctx.answerCallbackQuery();
    const filename = `report-${reportId}.md`;
    const file = new InputFile(Buffer.from(report, "utf-8"), filename);
    await ctx.replyWithDocument(file).catch((err) => console.error("Send document failed", err.message));
  });
}

export { registerCommands };

