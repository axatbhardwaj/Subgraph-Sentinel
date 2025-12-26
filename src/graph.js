import { rawRequest } from "graphql-request";
import { GRAPH_API_KEY } from "./config.js";

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

async function fetchSubgraph(url, query) {
  if (!url) return { error: "URL missing" };
  try {
    const headers = {};
    if (GRAPH_API_KEY) {
      headers["Authorization"] = `Bearer ${GRAPH_API_KEY}`;
    }
    const res = await rawRequest(url, query, {}, headers);
    const attestation = res.headers.get("graph-attestation") || null;
    return { data: res.data, attestation };
  } catch (error) {
    const msg = error.response?.errors?.[0]?.message || error.message || "unknown error";
    return { error: msg };
  }
}

export { gatewayUrl, resolveUrl, fetchSubgraph };

