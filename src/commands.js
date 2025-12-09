import fs from "fs";
import path from "path";
import { formatEth, formatInt, formatPct } from "./alerts.js";
import { store, getHistory, getSubs, saveSubs } from "./store.js";
import { DATA_DIR } from "./config.js";
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
    const report = await store.get("last:report");
    if (!report) {
      await ctx.reply("No recent detailed report available.");
      return;
    }
    await ctx.reply(report);
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
        "/alerts - subscription status",
        "/help - this message",
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
    const report = await store.get("last:report");
    if (!report) {
      await ctx.answerCallbackQuery({ text: "No recent report", show_alert: false });
      return;
    }
    await ctx.answerCallbackQuery();
    if (report.length > 3500) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `report-${ctx.chat.id}-${ts}.md`;
      const filepath = path.join(DATA_DIR, filename);
      try {
        await fs.promises.writeFile(filepath, report, "utf-8");
        const file = new InputFile(fs.createReadStream(filepath), filename);
        await ctx.replyWithDocument(file).catch((err) => console.error("Send document failed", err.message));
        setTimeout(() => {
          fs.promises.unlink(filepath).catch(() => {});
        }, 10 * 60 * 1000);
      } catch (err) {
        console.error("Report file write failed:", err.message);
        const file = new InputFile(Buffer.from(report, "utf-8"), filename);
        await ctx.replyWithDocument(file).catch((e) => console.error("Send document failed", e.message));
      }
    } else {
      await ctx.reply(report);
    }
  });
}

export { registerCommands };

