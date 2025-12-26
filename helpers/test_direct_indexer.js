import { rawRequest } from "graphql-request";
import { GRAPH_API_KEY, REGISTRY_QUERY, UPGRADE_INDEXER_ID } from "../src/config.js";

const deploymentId = "QmWZvSePaMQMX3LHTZyGmwZvFbGhm23t6Pa7iiVrRoqCnf";
const indexerId = UPGRADE_INDEXER_ID;

async function test() {
  const url = `https://gateway.thegraph.com/api/deployments/id/${deploymentId}/indexers/id/${indexerId}`;
  
  console.log(`Testing URL with API key in header: ${url}`);
  try {
    const res = await rawRequest(url, REGISTRY_QUERY, {}, {
        "Authorization": `Bearer ${GRAPH_API_KEY}`
    });
    console.log("Result: SUCCESS");
    console.log("Data:", JSON.stringify(res.data).slice(0, 100));
  } catch (err) {
    console.log("Result: FAILED");
    console.log("Error:", err.message);
  }
}

test();
