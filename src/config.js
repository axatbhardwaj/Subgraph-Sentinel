import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const ROOT = path.resolve(import.meta.dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const loadQuery = (filename) =>
  fs.readFileSync(path.join(ROOT, "src", "queries", filename), "utf-8");

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const GRAPH_API_KEY = process.env.GRAPH_GATEWAY_API_KEY || "";
export const INTERVAL_MS = 5 * 60 * 1000;
export const DATA_DIR = path.join(ROOT, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
export const LOG_FILE = process.env.LOG_FILE || path.join(DATA_DIR, "bot.log");
export const UPTIME_KUMA_PUSH_URL = process.env.UPTIME_KUMA_PUSH_URL || "";
export const UPTIME_KUMA_INTERVAL_MS = Number(
  process.env.UPTIME_KUMA_INTERVAL_MS || 120_000
);
export const ALERT_SEND_INTERVAL_MS = Number(
  process.env.ALERT_SEND_INTERVAL_MS || 300_000
);
export const ANALYSIS_HISTORY =
  Number(process.env.ANALYSIS_HISTORY || 10) || 10;
export const INCONSISTENCY_PCT_THRESHOLD =
  Number(process.env.INCONSISTENCY_PCT_THRESHOLD || 0.01);
export const NEW_MECH_FEES_QUERY = loadQuery("new-mech-fees.graphql");
export const FEES_QUERY = loadQuery("legacy-fees.graphql");
export const ATA_QUERY = loadQuery("ata.graphql");
export const REGISTRY_QUERY = loadQuery("registry-transactions.graphql");
export const ALLOCATION_QUERY = loadQuery("allocation.graphql");

export const FEES_SUBGRAPH_ID = "JCYjvfTErSkkFYjGedMHPnTcySpeB1Z81FLYUuEjWXK3";
export const NETWORK_SUBGRAPH_ID = "DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp";
export const UPGRADE_INDEXER_ID = "0xbdfb5ee5a2abf4fc7bb1bd1221067aef7f9de491";

export const SUBGRAPHS = [
  { name: "Gnosis MM", id: "5uBbKaSyWZaenxc2frFWqSASoXP952Yh2HheDdczqVoM", query: ATA_QUERY, type: "ATA", indexer: UPGRADE_INDEXER_ID, deploymentId: "QmabxEMFqZefVogxgLVaEHAoGgTLzJrVPgi8yoa4PZTamh" },
  { name: "Base MM", id: "vqXaQBmE9KTwF68BAYPFs7HwjPLpqKjDbtx3wXjTH5p", query: ATA_QUERY, type: "ATA" },
  { name: "Legacy Mech", env: "NEXT_PUBLIC_GNOSIS_LM_SUBGRAPH_URL", query: ATA_QUERY, type: "ATA" },
  { name: "Gnosis New Mech Fees", id: "FVimvzJV7aFP3GLzhL8uTXsDmPD9Wzp6tEBtzPsHfd3K", query: NEW_MECH_FEES_QUERY, type: "FEES_USD", indexer: UPGRADE_INDEXER_ID, deploymentId: "QmXhJ7w2J2fReYkRLjGM9QGKNEzBqSX81nLcSKpN676xvB" },
  { name: "Base New Mech Fees", id: "8a7YpqVVhiJBfLjFMwtH3jmHFUMAahfeHHGbh9vU26Tk", query: NEW_MECH_FEES_QUERY, type: "FEES_USD" },
  { name: "Gnosis Registry", id: "GmDw6a6EfP6z58dzkw5WehpxjaiEKB6aZRk4TNUm3DPn", query: REGISTRY_QUERY, type: "REGISTRY", indexer: UPGRADE_INDEXER_ID, deploymentId: "QmWZvSePaMQMX3LHTZyGmwZvFbGhm23t6Pa7iiVrRoqCnf" },
  { name: "Base Registry", id: "Baqj7bPWWQKw8HXwfqbMZnFhkSamuUYFa3JgCRYF8Tcr", query: REGISTRY_QUERY, type: "REGISTRY" },
  { name: "Mode Registry", env: "NEXT_PUBLIC_MODE_REGISTRY_SUBGRAPH_URL", query: REGISTRY_QUERY, type: "REGISTRY" },
  { name: "Optimism Registry", id: "BksA3aj8vX68TVs91ieDoGzFGASuLC7BaYo2HsGCea7p", query: REGISTRY_QUERY, type: "REGISTRY" },
  { name: "Celo Registry", id: "BxkMNoiEHdbJDtrmMG1bqVvUfwVUWnf5bn47WnCdB1A4", query: REGISTRY_QUERY, type: "REGISTRY" },
  { name: "Ethereum Registry", id: "89VhY3d7w6Ran1C86wkchzYNEG3rLBgWvyDUZMEFyjtQ", query: REGISTRY_QUERY, type: "REGISTRY" },
  { name: "Polygon Registry", id: "HHRBjVWFT2bV7eNSRqbCNDtUVnLPt911hcp8mSe4z6KG", query: REGISTRY_QUERY, type: "REGISTRY" },
  { name: "Arbitrum Registry", id: "GpQfE1C5DzXz1KCFvvj6jZkuhpMouwtbf9yYSv2y2V4p", query: REGISTRY_QUERY, type: "REGISTRY" },
];

export const DOMAIN = {
  name: "Graph Protocol",
  version: "0",
  chainId: 42161,
  verifyingContract: "0x0ab2b043138352413bb02e67e626a70320e3bd46",
  salt: "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2",
};

export const TYPES = {
  Receipt: [
    { name: "requestCID", type: "bytes32" },
    { name: "responseCID", type: "bytes32" },
    { name: "subgraphDeploymentID", type: "bytes32" },
  ],
};

