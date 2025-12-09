const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { GraphQLClient, gql } = require('graphql-request');

// Load .env from parent directory if not in current
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const API_KEY = process.env.GRAPH_GATEWAY_API_KEY;
if (!API_KEY) {
  console.error("Error: GRAPH_GATEWAY_API_KEY is missing in .env");
  process.exit(1);
}

const SUBGRAPH_ID = "JCYjvfTErSkkFYjGedMHPnTcySpeB1Z81FLYUuEjWXK3";
const NETWORK_SUBGRAPH_ID = "DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp"; // Graph Network on Arbitrum
const SUBGRAPH_URL = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${SUBGRAPH_ID}`;
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const LOG_FILE = path.join(__dirname, "response_log.json");

// EIP-712 Domain and Types
// The Graph Network runs on Arbitrum One - attestations are signed using Arbitrum domain
const DOMAIN = {
  name: "Graph Protocol",
  version: "0",
  chainId: 42161, // Arbitrum One
  verifyingContract: "0x0ab2b043138352413bb02e67e626a70320e3bd46", // DisputeManager on Arbitrum
  salt: "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2"
};

const TYPES = {
  Receipt: [
    { name: "requestCID", type: "bytes32" },
    { name: "responseCID", type: "bytes32" },
    { name: "subgraphDeploymentID", type: "bytes32" }
  ]
};

const QUERY = gql`
{
  _meta {
    block {
      number
      hash
    }
  }
  global(id: "") {
    totalFeesIn
    totalFeesInLegacyMech
    totalFeesInLegacyMechMarketPlace
  }
}
`;

async function fetchSubgraphData(url, query) {
  try {
    const client = new GraphQLClient(url);
    const { data, headers } = await client.rawRequest(query);
    const attestation = headers.get('graph-attestation');
    return { data, attestation };
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

async function lookupAllocation(allocationId) {
  const networkUrl = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${NETWORK_SUBGRAPH_ID}`;
  const query = gql`
    query GetAllocation($id: ID!) {
      allocation(id: $id) {
        id
        indexer {
          id
          defaultDisplayName
          url
        }
      }
    }
  `;
  
  try {
    const client = new GraphQLClient(networkUrl);
    const { allocation } = await client.request(query, { id: allocationId });
    if (!allocation) return null;
    
    return {
      indexer: allocation.indexer.id,
      name: allocation.indexer.defaultDisplayName || allocation.indexer.url || 'Unknown'
    };
  } catch (error) {
    console.error("Error looking up allocation:", error.message);
    return null;
  }
}

async function verifyAttestation(attestationJson) {
  try {
    const attestation = JSON.parse(attestationJson);
    
    const required = ['requestCID', 'responseCID', 'subgraphDeploymentID', 'r', 's'];
    if (!required.every(k => attestation[k]) || attestation.v === undefined) {
      console.error("Invalid attestation format");
      return null;
    }

    const message = {
      requestCID: attestation.requestCID,
      responseCID: attestation.responseCID,
      subgraphDeploymentID: attestation.subgraphDeploymentID
    };

    const signature = ethers.Signature.from({
      r: attestation.r,
      s: attestation.s,
      v: attestation.v
    });

    const allocationId = ethers.verifyTypedData(DOMAIN, TYPES, message, signature).toLowerCase();
    console.log("Allocation ID:", allocationId);
    
    const indexerInfo = await lookupAllocation(allocationId);
    if (indexerInfo) {
      console.log("Indexer:", indexerInfo.name, `(${indexerInfo.indexer})`);
    } else {
      console.log("Indexer: Unknown (allocation not found)");
    }
    
    return { allocationId, indexerInfo };
  } catch (error) {
    console.error("Error verifying attestation:", error);
    return null;
  }
}

function saveResponse(data, filepath, attestationResult) {
  let logs = [];
  try {
    if (fs.existsSync(filepath)) {
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      logs = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Error reading log file:", error);
  }

  const entry = {
    timestamp: new Date().toISOString(),
    allocationId: attestationResult?.allocationId || null,
    indexer: attestationResult?.indexerInfo?.indexer || null,
    indexerName: attestationResult?.indexerInfo?.name || null,
    data: data,
  };
  
  logs.push(entry);

  try {
    fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
    console.log("Saved response to", filepath);
  } catch (error) {
    console.error("Error writing log file:", error);
  }
}

async function runJob() {
  console.log("Running job...");
  const result = await fetchSubgraphData(SUBGRAPH_URL, QUERY);
  
  if (!result || !result.data) return;
  
  if (result.data.errors) {
    console.error("Subgraph returned errors:", JSON.stringify(result.data.errors, null, 2));
  }

  let attestationResult = null;
  if (result.attestation) {
    console.log("Attestation found, verifying...");
    attestationResult = await verifyAttestation(result.attestation);
  } else {
    console.log("No attestation header found.");
  }

  saveResponse(result.data, LOG_FILE, attestationResult);
}

// Run immediately
runJob();

// Schedule
setInterval(runJob, INTERVAL_MS);

