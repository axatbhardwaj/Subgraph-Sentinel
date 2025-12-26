import { request } from "graphql-request";
import { GRAPH_API_KEY, NETWORK_SUBGRAPH_ID } from "../src/config.js";
import { gatewayUrl } from "../src/graph.js";

const INDEXER_ID = "0xbdfb5ee5a2abf4fc7bb1bd1221067aef7f9de491";
const url = gatewayUrl(NETWORK_SUBGRAPH_ID);

const query = `
  query GetIndexerAllocations($indexer: ID!) {
    indexer(id: $indexer) {
      allocations(where: { status: Active }) {
        id
        subgraphDeployment {
          ipfsHash
        }
      }
    }
  }
`;

async function run() {
  console.log(`Checking allocations for indexer: ${INDEXER_ID}`);
  try {
    const headers = { "Authorization": `Bearer ${GRAPH_API_KEY}` };
    const data = await request(url, query, { indexer: INDEXER_ID }, headers);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
