import fs from "fs";
import path from "path";
import Keyv from "keyv";
import SQLite from "@keyv/sqlite";
import { DATA_DIR, LOG_FILE } from "./config.js";

const store = new Keyv({ store: new SQLite({ uri: `sqlite://${path.join(DATA_DIR, "state.sqlite")}` }) });
store.on("error", (err) => console.error("KeyV error:", err.message));

const nowIso = () => new Date().toISOString();

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

export { store, getHistory, pushHistory, getSubs, saveSubs };

