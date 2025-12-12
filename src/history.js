import fs from "fs";
import path from "path";
import { Database } from "bun:sqlite";
import { DATA_DIR } from "./config.js";

const dbPath = path.join(DATA_DIR, "state.sqlite");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(dbPath);
db.run("PRAGMA journal_mode = WAL");
db.run(`
  CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL,
    indexer TEXT,
    indexer_name TEXT,
    payload TEXT
  )
`);

function recordSampleHistory({ ts, name, type, value, indexer, indexerName, payload }) {
  db.run(
    `INSERT INTO samples (ts, name, type, value, indexer, indexer_name, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ts,
    name,
    type,
    value,
    indexer || null,
    indexerName || null,
    payload ? JSON.stringify(payload) : null
  );
}

function getSamples(from, to) {
  return db.query("SELECT * FROM samples WHERE ts >= ? AND ts <= ? ORDER BY ts ASC").all(from, to);
}

export { recordSampleHistory, getSamples };

