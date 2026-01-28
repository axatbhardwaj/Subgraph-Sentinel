import { Bot } from "grammy";
import { BOT_TOKEN, SYNC_CHECK_INTERVAL_MS } from "./config.js";
import { buildPoll, startHeartbeat } from "./jobs.js";
import { loadEndpoints } from "./endpoints.js";
import { registerCommands } from "./commands.js";
import { logger } from "./logger.js";

if (!BOT_TOKEN) {
  logger.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
registerCommands(bot);

const poll = buildPoll(bot);

const boot = async () => {
  loadEndpoints();
  await poll();
  setInterval(poll, SYNC_CHECK_INTERVAL_MS);
  startHeartbeat();
  await bot.start();
};

boot().catch((err) => {
  logger.error({ msg: "Bot failed to start", error: err.message });
  process.exit(1);
});

bot.catch = (err) => {
  logger.error({ msg: "Grammy error", error: err.error?.description || err.message });
};
