import fs from "fs";
import path from "path";
import Keyv from "keyv";
import SQLite from "@keyv/sqlite";
import { DATA_DIR, LOG_FILE } from "./config.js";

const store = new Keyv({ store: new SQLite({ uri: `sqlite://${path.join(DATA_DIR, "state.sqlite")}` }) });
store.on("error", (err) => console.error("KeyV error:", err.message));

const nowIso = () => new Date().toISOString();
const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const colorize = (line, entry) => {
  if (!process.stdout.isTTY) return line;
  if (entry.type === "alert") return `${COLORS.yellow}${line}${COLORS.reset}`;
  if (entry.type === "heartbeat") {
    return entry.status === "fail"
      ? `${COLORS.red}${line}${COLORS.reset}`
      : `${COLORS.green}${line}${COLORS.reset}`;
  }
  if (entry.type === "poll") return `${COLORS.cyan}${line}${COLORS.reset}`;
  return `${COLORS.gray}${line}${COLORS.reset}`;
};

const tsHuman = (ts) => {
  const d = new Date(ts);
  const pad = (v, len = 2) => v.toString().padStart(len, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const ms = pad(d.getMilliseconds(), 3);
  return `${date} ${time},${ms}`;
};

const humanLine = (obj) => {
  const level =
    obj.type === "heartbeat" && obj.status === "fail"
      ? "ERROR"
      : obj.type === "alert"
        ? "INFO"
        : "INFO";
  let msg = JSON.stringify(obj);
  if (obj.type === "heartbeat") {
    msg = obj.status === "fail" ? `Heartbeat failed: ${obj.error || "unknown"}` : "Heartbeat sent successfully.";
  } else if (obj.type === "poll") {
    msg = `Poll completed alerts=${obj.alertsCount ?? 0}`;
  } else if (obj.type === "alert" && Array.isArray(obj.messages)) {
    msg = obj.messages.join(" | ");
  }
  return `${tsHuman(obj.ts)} - ${level} - ${msg}\n`;
};

async function getHistory() {
  return (await store.get("history")) || [];
}

async function pushHistory(message) {
  const history = await getHistory();
  history.push({ ts: nowIso(), message });
  if (history.length > 40) history.shift();
  await store.set("history", history);
}

async function getSubs() {
  const subs = (await store.get("subs")) || [];
  return Array.from(new Set(subs));
}

async function saveSubs(subs) {
  await store.set("subs", Array.from(new Set(subs)));
}

function appendLog(entry) {
  const obj = { ts: nowIso(), ...entry };
  const line = JSON.stringify(obj) + "\n";
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error("Log write failed:", err.message);
  });
  // Also mirror to stdout for live visibility
  const pretty = humanLine(obj);
  process.stdout.write(colorize(pretty, entry));
}

export { store, getHistory, pushHistory, getSubs, saveSubs, appendLog };

