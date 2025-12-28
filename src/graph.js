import { rawRequest } from "graphql-request";
import { GRAPH_API_KEY, GRAPH_API_KEY_2 } from "./config.js";

const gatewayUrl = (id, indexer = null, deploymentId = null) => {
  if (indexer) {
    const targetId = deploymentId || id;
    return `https://gateway.thegraph.com/api/deployments/id/${targetId}/indexers/id/${indexer}`;
  }
  return `https://gateway.thegraph.com/api/subgraphs/id/${id}`;
};

const resolveUrl = (entry) => {
  if (entry.env) return process.env[entry.env] || "";
  if (entry.id) return gatewayUrl(entry.id, entry.indexer, entry.deploymentId);
  return "";
};

async function executeRequest(url, query, variables = {}, apiKey) {
  try {
    const headers = {};
    // Only attach header if it's a gateway URL and we have a key
    if (apiKey && url.includes("gateway.thegraph.com")) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const res = await rawRequest(url, query, variables, headers);
    const attestation = res.headers.get("graph-attestation") || null;
    return { data: res.data, attestation };
  } catch (error) {
    const msg = error.response?.errors?.[0]?.message || error.message || "unknown error";
    // Propagate error to allow retry
    throw new Error(msg);
  }
}

async function fetchSubgraph(url, query, variables = {}) {
  if (!url) return { error: "URL missing" };

  try {
    return await executeRequest(url, query, variables, GRAPH_API_KEY);
  } catch (err) {
    const msg = err.message;
    // If we have a second key and the first failed (especially for auth/payment reasons, but we try generally)
    if (GRAPH_API_KEY_2 && url.includes("gateway.thegraph.com")) {
      try {
        return await executeRequest(url, query, variables, GRAPH_API_KEY_2);
      } catch (err2) {
        return { error: `Primary: ${msg}, Secondary: ${err2.message}` };
      }
    }
    return { error: msg };
  }
}

export { gatewayUrl, resolveUrl, fetchSubgraph };
