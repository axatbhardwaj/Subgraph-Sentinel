import fs from "fs";
import path from "path";
import { DATA_DIR, SUBGRAPHS } from "./config.js";
import { logger } from "./logger.js";

/**
 * @typedef {Object} Endpoint
 * @property {string} name
 * @property {string} chain
 * @property {string} [url]
 * @property {string} [id]
 * @property {string} [env]
 * @property {boolean} active
 */

const ENDPOINTS_FILE = path.join(DATA_DIR, "endpoints.json");

/** @type {Map<string, Endpoint[]>} */
let endpointsByChain = new Map();

/** @type {Endpoint[]} */
let allEndpoints = [];

function migrateDefaults() {
  return SUBGRAPHS.map((sg) => ({
    name: sg.name,
    chain: sg.chain,
    url: sg.env ? process.env[sg.env] : undefined,
    id: sg.id,
    env: sg.env,
    active: true,
  }));
}

function groupByChain(endpoints) {
  const grouped = new Map();
  for (const ep of endpoints) {
    if (!ep.chain) {
      logger.error({ msg: "Endpoint missing chain field", name: ep.name });
      continue;
    }
    if (!grouped.has(ep.chain)) grouped.set(ep.chain, []);
    grouped.get(ep.chain).push(ep);
  }
  return grouped;
}

function initializeEndpointsFile() {
  logger.info({ msg: "Endpoints file not found, migrating defaults", file: ENDPOINTS_FILE });
  const defaults = migrateDefaults();
  fs.writeFileSync(ENDPOINTS_FILE, JSON.stringify(defaults, null, 2), "utf-8");
  allEndpoints = defaults;
  endpointsByChain = groupByChain(defaults);
  return endpointsByChain;
}

export function loadEndpoints() {
  if (!fs.existsSync(ENDPOINTS_FILE)) return initializeEndpointsFile();

  const raw = fs.readFileSync(ENDPOINTS_FILE, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logger.error({ msg: "Failed to parse endpoints.json", file: ENDPOINTS_FILE, error: err.message });
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    logger.error({ msg: "endpoints.json must be an array", file: ENDPOINTS_FILE });
    process.exit(1);
  }

  // Strip legacy fields from existing endpoints
  allEndpoints = parsed.map((ep) => ({
    name: ep.name,
    chain: ep.chain,
    url: ep.url,
    id: ep.id,
    env: ep.env,
    active: ep.active !== false,
  }));
  endpointsByChain = groupByChain(allEndpoints);
  logger.info({ msg: "Loaded endpoints", count: allEndpoints.length, chains: Array.from(endpointsByChain.keys()) });
  return endpointsByChain;
}

function commitEndpoints(updatedList) {
  const serialized = JSON.stringify(updatedList, null, 2);
  fs.writeFileSync(ENDPOINTS_FILE, serialized, "utf-8");
  allEndpoints = updatedList;
  endpointsByChain = groupByChain(updatedList);
}

export function addEndpoint(endpoint) {
  if (!endpoint.name || !endpoint.chain) {
    throw new Error("Endpoint must have name and chain");
  }

  if (allEndpoints.some((ep) => ep.name === endpoint.name)) {
    throw new Error(`Endpoint with name "${endpoint.name}" already exists`);
  }

  const simplified = {
    name: endpoint.name,
    chain: endpoint.chain,
    url: endpoint.url,
    id: endpoint.id,
    env: endpoint.env,
    active: true,
  };

  commitEndpoints([...allEndpoints, simplified]);
  logger.info({ msg: "Endpoint added", name: endpoint.name, chain: endpoint.chain });
}

export function removeEndpoint(name) {
  const updated = allEndpoints.filter((ep) => ep.name !== name);
  if (updated.length === allEndpoints.length) {
    throw new Error(`Endpoint "${name}" not found`);
  }

  commitEndpoints(updated);
  logger.info({ msg: "Endpoint removed", name });
}

export function getAll() {
  return allEndpoints.filter((ep) => ep.active !== false);
}

export function getByChain(chain) {
  const endpoints = endpointsByChain.get(chain) || [];
  return endpoints.filter((ep) => ep.active !== false);
}

export function getChains() {
  return Array.from(endpointsByChain.keys());
}
