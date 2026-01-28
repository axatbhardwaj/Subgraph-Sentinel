import path from "path";
import fs from "fs";
import dotenv from "dotenv";

const ROOT = path.resolve(import.meta.dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const GRAPH_API_KEY = process.env.GRAPH_GATEWAY_API_KEY || "";
export const GRAPH_API_KEY_2 = process.env.GRAPH_GATEWAY_API_KEY2 || "";
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
export const POLL_CONCURRENCY = Number(process.env.POLL_CONCURRENCY || 20);

// Sync monitoring configuration
export const SYNC_LAG_THRESHOLD = Number(
  process.env.SYNC_LAG_THRESHOLD || 100
);
export const SYNC_CHECK_INTERVAL_MS = Number(
  process.env.SYNC_CHECK_INTERVAL_MS || 300_000
);

// Standard meta query for all subgraphs
export const META_QUERY = `{ _meta { block { number } hasIndexingErrors } }`;

// RPC URLs per chain for comparing against subgraph block height
export const RPC_URLS = {
  gnosis: process.env.GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
  base: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  ethereum: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
  polygon: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  arbitrum: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  celo: process.env.CELO_RPC_URL || "https://forno.celo.org",
  optimism: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
  mode: process.env.MODE_RPC_URL || "https://mainnet.mode.network",
};

// Default subgraphs to migrate if no endpoints.json exists
export const SUBGRAPHS = [
  { name: "Gnosis MM", chain: "gnosis", id: "5uBbKaSyWZaenxc2frFWqSASoXP952Yh2HheDdczqVoM" },
  { name: "Base MM", chain: "base", id: "vqXaQBmE9KTwF68BAYPFs7HwjPLpqKjDbtx3wXjTH5p" },
  { name: "Legacy Mech", chain: "gnosis", env: "NEXT_PUBLIC_GNOSIS_LM_SUBGRAPH_URL" },
  { name: "Gnosis New Mech Fees", chain: "gnosis", id: "FVimvzJV7aFP3GLzhL8uTXsDmPD9Wzp6tEBtzPsHfd3K" },
  { name: "Base New Mech Fees", chain: "base", id: "8a7YpqVVhiJBfLjFMwtH3jmHFUMAahfeHHGbh9vU26Tk" },
  { name: "Gnosis Registry", chain: "gnosis", id: "GmDw6a6EfP6z58dzkw5WehpxjaiEKB6aZRk4TNUm3DPn" },
  { name: "Base Registry", chain: "base", id: "Baqj7bPWWQKw8HXwfqbMZnFhkSamuUYFa3JgCRYF8Tcr" },
  { name: "Mode Registry", chain: "mode", env: "NEXT_PUBLIC_MODE_REGISTRY_SUBGRAPH_URL" },
  { name: "Optimism Registry", chain: "optimism", id: "BksA3aj8vX68TVs91ieDoGzFGASuLC7BaYo2HsGCea7p" },
  { name: "Celo Registry", chain: "celo", id: "BxkMNoiEHdbJDtrmMG1bqVvUfwVUWnf5bn47WnCdB1A4" },
  { name: "Ethereum Registry", chain: "ethereum", id: "89VhY3d7w6Ran1C86wkchzYNEG3rLBgWvyDUZMEFyjtQ" },
  { name: "Polygon Registry", chain: "polygon", id: "HHRBjVWFT2bV7eNSRqbCNDtUVnLPt911hcp8mSe4z6KG" },
  { name: "Arbitrum Registry", chain: "arbitrum", id: "GpQfE1C5DzXz1KCFvvj6jZkuhpMouwtbf9yYSv2y2V4p" },
];
