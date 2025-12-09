import { Bot } from "grammy";
import { BOT_TOKEN, INTERVAL_MS } from "./config.js";
import { buildPoll, startHeartbeat } from "./jobs.js";
import { registerCommands } from "./commands.js";

if (!BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
registerCommands(bot);

const poll = buildPoll(bot);

const boot = async () => {
  await poll();
  setInterval(poll, INTERVAL_MS);
  startHeartbeat();
  await bot.start();
};

boot().catch((err) => {
  console.error("Bot failed to start:", err.message);
  process.exit(1);
});

bot.catch = (err) => {
  console.error("Grammy error:", err.error?.description || err.message);
};

