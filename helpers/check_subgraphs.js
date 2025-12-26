import { request } from "graphql-request";
import { GRAPH_API_KEY, NETWORK_SUBGRAPH_ID } from "../src/config.js";
import { gatewayUrl } from "../src/graph.js";

const SUBGRAPH_IDS = [
  "5uBbKaSyWZaenxc2frFWqSASoXP952Yh2HheDdczqVoM", // Gnosis MM
  "FVimvzJV7aFP3GLzhL8uTXsDmPD9Wzp6tEBtzPsHfd3K", // Gnosis New Mech Fees
  "GmDw6a6EfP6z58dzkw5WehpxjaiEKB6aZRk4TNUm3DPn"  // Gnosis Registry
];

const url = gatewayUrl(NETWORK_SUBGRAPH_ID);

const query = `
  query GetSubgraphInfo($ids: [ID!]!) {
    subgraphs(where: { id_in: $ids }) {
      id
      currentVersion {
        subgraphDeployment {
          ipfsHash
          indexerAllocations(where: { status: Active }) {
            indexer {
              id
              defaultDisplayName
              url
            }
          }
        }
      }
    }
  }
`;

async function run() {
  console.log(`Checking subgraphs: ${SUBGRAPH_IDS.join(", ")}`);
  try {
    const headers = { "Authorization": `Bearer ${GRAPH_API_KEY}` };
    const data = await request(url, query, { ids: SUBGRAPH_IDS }, headers);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
