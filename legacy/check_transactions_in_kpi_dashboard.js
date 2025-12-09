// This script is used to check the transactions in the KPI dashboard.
// It is used to check the transactions in the KPI dashboard for the following subgraphs:
// for ata we use 3 subgraphs:
// - Gnosis MM
// - Base MM
// - Legacy Mech
// for registry we use 8 subgraphs:
// - Gnosis Registry
// - Base Registry
// - Mode Registry
// - Optimism Registry
// - Celo Registry
// - Ethereum Registry
// - Polygon Registry
// - Arbitrum Registry



import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { GraphQLClient, gql } from 'graphql-request';
import dotenv from 'dotenv';

// Load .env from parent directory if not in current
dotenv.config({ path: path.resolve(import.meta.dir, '../../.env') });

const API_KEY = process.env.GRAPH_GATEWAY_API_KEY;
// We allow running without API Key if user doesn't want attestation verification, 
// but looking up allocations requires it.
const NETWORK_SUBGRAPH_ID = "DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp"; // Graph Network on Arbitrum
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const LOG_FILE = path.join(import.meta.dir, "kpi_metrics_log.json");

// EIP-712 Domain and Types
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

// Queries
const ATA_QUERY = gql`
  query AtaTransactions {
    globals(where: { id: "" }) {
      id
      totalAtaTransactions
    }
  }
`;

const LEGACY_MECH_QUERY = gql`
  query AtaTransactions {
    global(id: "") {
      totalFeesIn
      totalFeesInLegacyMech
      totalFeesInLegacyMechMarketPlace
    }
  }
`;

const REGISTRY_QUERY = gql`
  query RegistryGlobals {
    global(id: "") {
      id
      txCount
    }
  }
`;

// Configuration
const SUBGRAPHS = [
  // ATA Transactions (Mech Marketplace)
  { name: 'Gnosis MM', id: '5uBbKaSyWZaenxc2frFWqSASoXP952Yh2HheDdczqVoM', query: ATA_QUERY, type: 'ATA' },
  { name: 'Base MM', id: 'vqXaQBmE9KTwF68BAYPFs7HwjPLpqKjDbtx3wXjTH5p', query: ATA_QUERY, type: 'ATA' },
  { name: 'Legacy Mech', env: 'NEXT_PUBLIC_GNOSIS_LM_SUBGRAPH_URL', query: ATA_QUERY, type: 'ATA' },
  
  // Registry Transactions
  { name: 'Gnosis Registry', id: 'GmDw6a6EfP6z58dzkw5WehpxjaiEKB6aZRk4TNUm3DPn', query: REGISTRY_QUERY, type: 'REGISTRY' },
  { name: 'Base Registry', id: 'Baqj7bPWWQKw8HXwfqbMZnFhkSamuUYFa3JgCRYF8Tcr', query: REGISTRY_QUERY, type: 'REGISTRY' },
  { name: 'Mode Registry', env: 'NEXT_PUBLIC_MODE_REGISTRY_SUBGRAPH_URL', query: REGISTRY_QUERY, type: 'REGISTRY' },
  { name: 'Optimism Registry', id: 'BksA3aj8vX68TVs91ieDoGzFGASuLC7BaYo2HsGCea7p', query: REGISTRY_QUERY, type: 'REGISTRY' },
  { name: 'Celo Registry', id: 'BxkMNoiEHdbJDtrmMG1bqVvUfwVUWnf5bn47WnCdB1A4', query: REGISTRY_QUERY, type: 'REGISTRY' },
  { name: 'Ethereum Registry', id: '89VhY3d7w6Ran1C86wkchzYNEG3rLBgWvyDUZMEFyjtQ', query: REGISTRY_QUERY, type: 'REGISTRY' },
  { name: 'Polygon Registry', id: 'HHRBjVWFT2bV7eNSRqbCNDtUVnLPt911hcp8mSe4z6KG', query: REGISTRY_QUERY, type: 'REGISTRY' },
  { name: 'Arbitrum Registry', id: 'GpQfE1C5DzXz1KCFvvj6jZkuhpMouwtbf9yYSv2y2V4p', query: REGISTRY_QUERY, type: 'REGISTRY' },
];

async function fetchSubgraphData(name, idOrUrl, query, isEnvVar = false) {
  let url;
  if (isEnvVar) {
     url = process.env[idOrUrl];
  } else {
     // Use Gateway URL for Decentralized Network
     url = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${idOrUrl}`;
  }

  if (!url) {
    console.warn(`Warning: URL/ID for ${name} is missing.`);
    return { name, error: "Missing URL" };
  }

  // Debug: Print URL being used (truncated)
  console.log(`Fetching ${name} from ${url.substring(0, 50)}...`);

  try {
    const client = new GraphQLClient(url);
    const result = await client.rawRequest(query);
    const data = result.data;
    const attestation = result.headers.get('graph-attestation');
    
    if (!data) {
       console.error(`Error: No data returned for ${name}`);
       if (result.errors) {
         console.error(`GraphQL Errors for ${name}:`, JSON.stringify(result.errors, null, 2));
       }
       // Log full result for debugging
       console.log(`Full result for ${name}:`, JSON.stringify(result, null, 2));
       return { name, error: "No data returned", success: false };
    }

    return { name, data, attestation, success: true };
  } catch (error) {
    console.error(`Error fetching data for ${name}:`, error.message);
    return { name, error: error.message, success: false };
  }
}

async function lookupAllocation(allocationId) {
  if (!API_KEY) return null; // Cannot lookup without API Key
  
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
    
    const indexerInfo = await lookupAllocation(allocationId);
    
    return { allocationId, indexerInfo };
  } catch (error) {
    console.error("Error verifying attestation:", error);
    return null;
  }
}

async function processResults(results) {
  let totalAta = 0;
  let totalTx = 0;
  const processed = [];

  for (const res of results) {
    const entry = {
      name: res.name,
      success: res.success,
      allocationId: null,
      indexer: null,
      indexerName: null
    };

    if (res.success) {
      if (res.attestation) {
        const attestationData = await verifyAttestation(res.attestation);
        if (attestationData) {
          entry.allocationId = attestationData.allocationId;
          entry.indexer = attestationData.indexerInfo?.indexer || null;
          entry.indexerName = attestationData.indexerInfo?.name || null;
        }
      }

      const subgraphConfig = SUBGRAPHS.find(s => s.name === res.name);
      
      if (subgraphConfig.type === 'ATA') {
        const val = res.data.globals?.[0]?.totalAtaTransactions || "0";
        const count = parseInt(val, 10);
        entry.value = count;
        totalAta += count;
      } else if (subgraphConfig.type === 'REGISTRY') {
        const val = res.data.global?.txCount || "0";
        const count = parseInt(val, 10);
        entry.value = count;
        totalTx += count;
      }
    } else {
      entry.error = res.error;
    }
    processed.push(entry);
  }

  return {
    timestamp: new Date().toISOString(),
    totals: {
      totalAtaTransactions: totalAta,
      totalTransactions: totalTx
    },
    details: processed
  };
}

function saveLog(logEntry, filepath) {
  let logs = [];
  try {
    if (fs.existsSync(filepath)) {
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      logs = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Error reading log file:", error);
  }

  logs.push(logEntry);

  try {
    fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
    console.log("Saved aggregated response to", filepath);
    console.log("Total ATA:", logEntry.totals.totalAtaTransactions);
    console.log("Total TX:", logEntry.totals.totalTransactions);
  } catch (error) {
    console.error("Error writing log file:", error);
  }
}

async function runJob() {
  console.log("Starting job: Fetching from all subgraphs...");
  
  const promises = SUBGRAPHS.map(sg => {
    if (sg.id) {
       return fetchSubgraphData(sg.name, sg.id, sg.query, false);
    } else {
       return fetchSubgraphData(sg.name, sg.env, sg.query, true);
    }
  });

  const rawResults = await Promise.all(promises);
  const finalLog = await processResults(rawResults);
  
  saveLog(finalLog, LOG_FILE);
}

// Run immediately
runJob();

// Schedule
setInterval(runJob, INTERVAL_MS);
