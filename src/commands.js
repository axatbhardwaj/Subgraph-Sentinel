import { store, getHistory, getSubs, saveSubs } from "./store.js";
import { getAll, addEndpoint, removeEndpoint } from "./endpoints.js";
import { runSyncChecks, getSyncStatus, formatLag } from "./sync.js";
import { SYNC_LAG_THRESHOLD, POLL_CONCURRENCY } from "./config.js";
import { InputFile } from "grammy";
import { logger } from "./logger.js";

function registerCommands(bot) {
  bot.command("start", async (ctx) => {
    const subs = await getSubs();
    if (!subs.includes(ctx.chat.id)) {
      subs.push(ctx.chat.id);
      await saveSubs(subs);
    }
    await ctx.reply("Subscribed to sync alerts. Use /mute to stop.");
  });

  bot.command("mute", async (ctx) => {
    const subs = await getSubs();
    const next = subs.filter((id) => id !== ctx.chat.id);
    await saveSubs(next);
    await ctx.reply("Muted. Use /start to subscribe again.");
  });

  bot.command("status", async (ctx) => {
    const endpoints = getAll();
    if (!endpoints.length) {
      await ctx.reply("No endpoints configured.");
      return;
    }

    const statuses = await Promise.all(
      endpoints.slice(0, 10).map(async (ep) => {
        const sync = await getSyncStatus(ep.name);
        const emoji = sync.status === "ok" ? "🟢"
          : sync.status === "lagging" ? "🔴"
          : sync.status === "indexing-error" ? "⚠️"
          : sync.status === "error" ? "❌"
          : "⚪";
        const lagStr = sync.lag !== null ? ` (lag: ${formatLag(sync.lag)})` : "";
        return `${emoji} ${ep.name}${lagStr}`;
      })
    );

    const more = endpoints.length > 10 ? `\n\n... and ${endpoints.length - 10} more. Use /endpoints for full list.` : "";
    await ctx.reply(statuses.join("\n") + more);
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
        ? "Alerts are ON for this chat. Signals: sync lag, indexing errors, fetch failures."
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
    await ctx.replyWithDocument(file).catch((err) => logger.error({ msg: "Send document failed", error: err.message }));
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "/start - subscribe to alerts",
        "/mute - stop alerts",
        "/status - top 10 endpoints with sync status",
        "/history - recent alerts",
        "/check - run sync checks manually",
        "/report - last detailed alert batch",
        "/endpoints - list all endpoints with status",
        "/endpoint_add - add endpoint (<chain> <url> <name>)",
        "/endpoint_remove - remove endpoint",
        "/explain - what the bot monitors",
        "/alerts - subscription status",
        "/help - this message",
      ].join("\n")
    );
  });

  bot.command("explain", async (ctx) => {
    await ctx.reply(
      [
        "Subgraph Sentinel monitors The Graph subgraphs for sync status:",
        "",
        "What it checks:",
        `- Block lag: subgraph block vs chain head (threshold: ${SYNC_LAG_THRESHOLD} blocks)`,
        "- Indexing errors: _meta.hasIndexingErrors flag",
        "- Fetch failures: GraphQL endpoint unreachable",
        "",
        "Alerts:",
        "- 🔴 Lagging: subgraph is more than threshold blocks behind",
        "- ⚠️ Indexing errors: subgraph reports indexing problems",
        "- ❌ Fetch failed: couldn't reach the subgraph endpoint",
        "- 🟢 Recovered: issue resolved",
        "",
        "Commands:",
        "- /status: Quick overview of top 10 endpoints",
        "- /endpoints: Full list with sync status",
        "- /check: Run manual sync check",
        "- /endpoint_add <chain> <url> <name>: Add endpoint",
        "- /endpoint_remove <name>: Remove endpoint",
        "",
        "Data stored in data/endpoints.json and data/state.sqlite.",
      ].join("\n")
    );
  });

  bot.command("endpoints", async (ctx) => {
    const endpoints = getAll();
    if (!endpoints.length) {
      await ctx.reply("No endpoints configured.");
      return;
    }

    const lines = await Promise.all(
      endpoints.map(async (ep) => {
        const sync = await getSyncStatus(ep.name);
        const emoji = sync.status === "ok" ? "🟢"
          : sync.status === "lagging" ? "🔴"
          : sync.status === "indexing-error" ? "⚠️"
          : sync.status === "error" ? "❌"
          : "⚪";
        const lagStr = sync.lag !== null ? ` lag:${formatLag(sync.lag)}` : "";
        return `${emoji} ${ep.name} (${ep.chain})${lagStr}`;
      })
    );

    if (lines.length <= 20) {
      await ctx.reply(lines.join("\n"));
    } else {
      const page1 = lines.slice(0, 20).join("\n");
      await ctx.reply(`${page1}\n\n... showing 20 of ${lines.length} endpoints`);
    }
  });

  bot.command("check", async (ctx) => {
    await ctx.reply("Running sync checks...");
    const endpoints = getAll();
    const { results, alerts } = await runSyncChecks(endpoints, POLL_CONCURRENCY);

    let ok = 0;
    let lagging = 0;
    let errors = 0;
    let fetchFail = 0;

    for (const r of results) {
      if (r.error) fetchFail++;
      else if (r.lag !== null && r.lag > SYNC_LAG_THRESHOLD) lagging++;
      else if (r.hasIndexingErrors) errors++;
      else ok++;
    }

    const summary = `Sync check complete:\n🟢 ${ok} ok\n🔴 ${lagging} lagging\n⚠️ ${errors} indexing errors\n❌ ${fetchFail} fetch failures`;
    const changes = alerts.length > 0 ? `\n\nStatus changes:\n${alerts.slice(0, 5).join("\n")}${alerts.length > 5 ? `\n...and ${alerts.length - 5} more` : ""}` : "";
    await ctx.reply(summary + changes);
  });

  bot.command("endpoint_add", async (ctx) => {
    const text = (ctx.message?.text || "").trim();
    const parts = text.split(/\s+/);

    if (parts.length < 4) {
      await ctx.reply("Usage: /endpoint_add <chain> <url> <name>");
      return;
    }

    const chain = parts[1];
    const url = parts[2];
    const name = parts.slice(3).join(" ");

    const validChains = ["gnosis", "base", "ethereum", "polygon", "arbitrum", "celo", "optimism", "mode"];
    if (!validChains.includes(chain.toLowerCase())) {
      await ctx.reply(`Invalid chain. Valid chains: ${validChains.join(", ")}`);
      return;
    }

    try {
      addEndpoint({
        name,
        chain: chain.toLowerCase(),
        url,
        active: true,
      });
      await ctx.reply(`Added endpoint: ${name} (${chain})`);
    } catch (err) {
      logger.error({ msg: "endpoint_add failed", error: err.message });
      await ctx.reply(`Error: ${err.message}`);
    }
  });

  bot.command("endpoint_remove", async (ctx) => {
    const text = (ctx.message?.text || "").trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2) {
      await ctx.reply("Usage: /endpoint_remove <name>");
      return;
    }

    const name = parts.slice(1).join(" ");

    try {
      removeEndpoint(name);
      await ctx.reply(`Removed endpoint: ${name}`);
    } catch (err) {
      logger.error({ msg: "endpoint_remove failed", error: err.message });
      await ctx.reply(`Error: ${err.message}`);
    }
  });

  bot.callbackQuery(/^report:/, async (ctx) => {
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
    await ctx.replyWithDocument(file).catch((err) => logger.error({ msg: "Send document failed", error: err.message }));
  });
}

export { registerCommands };
