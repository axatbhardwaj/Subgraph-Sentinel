import { ethers } from "ethers";
import { request } from "graphql-request";
import { DOMAIN, TYPES, GRAPH_API_KEY, NETWORK_SUBGRAPH_ID, ALLOCATION_QUERY } from "./config.js";
import { gatewayUrl } from "./graph.js";

const required = (obj, keys) => keys.every((k) => obj && obj[k] !== undefined);

function parseAttestation(json) {
  try {
    const parsed = JSON.parse(json);
    if (!required(parsed, ["requestCID", "responseCID", "subgraphDeploymentID", "r", "s", "v"])) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function verifyAllocation(att) {
  try {
    const sig = ethers.Signature.from({ r: att.r, s: att.s, v: att.v });
    return ethers.verifyTypedData(DOMAIN, TYPES, att, sig).toLowerCase();
  } catch {
    return null;
  }
}

async function lookupAllocation(allocationId) {
  if (!allocationId || !GRAPH_API_KEY) return null;
  const url = gatewayUrl(NETWORK_SUBGRAPH_ID);
  try {
    const headers = { "Authorization": `Bearer ${GRAPH_API_KEY}` };
    const { allocation } = await request(url, ALLOCATION_QUERY, { id: allocationId }, headers);
    if (!allocation) return null;
    const name = allocation.indexer.defaultDisplayName || allocation.indexer.url || "Unknown";
    return { indexer: allocation.indexer.id, name };
  } catch {
    return null;
  }
}

async function resolveIndexer(attestationJson) {
  if (!attestationJson) return null;
  const att = parseAttestation(attestationJson);
  if (!att) return null;
  const allocationId = verifyAllocation(att);
  if (!allocationId) return null;
  const info = await lookupAllocation(allocationId);
  return info ? { allocationId, ...info } : { allocationId };
}

export { resolveIndexer };

