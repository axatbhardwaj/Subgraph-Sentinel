import { rawRequest } from "graphql-request";
import { GRAPH_API_KEY } from "./config.js";

const gatewayUrl = (id) =>
  GRAPH_API_KEY ? `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${id}` : "";

const resolveUrl = (entry) => {
  if (entry.env) return process.env[entry.env] || "";
  if (entry.id) return gatewayUrl(entry.id);
  return "";
};

async function fetchSubgraph(url, query) {
  if (!url) return { error: "URL missing" };
  try {
    const res = await rawRequest(url, query);
    const attestation = res.headers.get("graph-attestation") || null;
    return { data: res.data, attestation };
  } catch (error) {
    const msg = error.response?.errors?.[0]?.message || error.message || "unknown error";
    return { error: msg };
  }
}

export { gatewayUrl, resolveUrl, fetchSubgraph };

