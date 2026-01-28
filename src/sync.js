import { RPC_URLS, META_QUERY, SYNC_LAG_THRESHOLD, GRAPH_API_KEY, GRAPH_API_KEY_2 } from "./config.js";
import { store } from "./store.js";
import { logger } from "./logger.js";

const rpcCache = new Map();

function getRpcUrl(chain) {
  const url = RPC_URLS[chain];
  if (!url) {
    logger.warn({ msg: "No RPC URL for chain", chain });
    return null;
  }
  return url;
}

async function getChainHead(chain) {
  const url = getRpcUrl(chain);
  if (!url) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }

  return parseInt(data.result, 16);
}

function resolveEndpointUrl(endpoint) {
  if (endpoint.url) return endpoint.url;
  if (endpoint.env) return process.env[endpoint.env] || null;
  if (endpoint.id) return `https://gateway.thegraph.com/api/subgraphs/id/${endpoint.id}`;
  return null;
}

async function fetchMeta(url) {
  const headers = { "Content-Type": "application/json" };
  if (url.includes("gateway.thegraph.com") && GRAPH_API_KEY) {
    headers["Authorization"] = `Bearer ${GRAPH_API_KEY}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: META_QUERY }),
  });

  if (!response.ok) {
    if (response.status === 402 && GRAPH_API_KEY_2 && url.includes("gateway.thegraph.com")) {
      headers["Authorization"] = `Bearer ${GRAPH_API_KEY_2}`;
      const retry = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: META_QUERY }),
      });
      if (!retry.ok) throw new Error(`HTTP ${retry.status}`);
      return retry.json();
    }
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function getSubgraphBlock(url) {
  const result = await fetchMeta(url);
  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }
  const meta = result.data?._meta;
  if (!meta) {
    throw new Error("No _meta in response");
  }
  return {
    block: meta.block?.number || 0,
    hasIndexingErrors: meta.hasIndexingErrors || false,
  };
}

async function checkSync(endpoint) {
  const url = resolveEndpointUrl(endpoint);
  if (!url) {
    return { error: "URL missing", name: endpoint.name };
  }

  try {
    const [chainHead, subgraph] = await Promise.all([
      getChainHead(endpoint.chain),
      getSubgraphBlock(url),
    ]);

    if (chainHead === null) {
      return {
        name: endpoint.name,
        chain: endpoint.chain,
        subgraphBlock: subgraph.block,
        chainHead: null,
        lag: null,
        hasIndexingErrors: subgraph.hasIndexingErrors,
      };
    }

    const lag = chainHead - subgraph.block;
    return {
      name: endpoint.name,
      chain: endpoint.chain,
      subgraphBlock: subgraph.block,
      chainHead,
      lag,
      hasIndexingErrors: subgraph.hasIndexingErrors,
    };
  } catch (err) {
    return { error: err.message, name: endpoint.name, chain: endpoint.chain };
  }
}

function formatLag(lag) {
  if (lag === null) return "n/a";
  if (lag < 1000) return `${lag}`;
  if (lag < 1000000) return `${(lag / 1000).toFixed(1)}k`;
  return `${(lag / 1000000).toFixed(1)}M`;
}

async function updateSyncAlertState(result) {
  const key = `sync:alert:${result.name}`;
  const prev = (await store.get(key)) || { lagAlert: false, errorAlert: false, fetchFail: false };
  const alerts = [];

  if (result.error) {
    if (!prev.fetchFail) {
      alerts.push(`❌ ${result.name}: fetch failed (${result.error})`);
    }
    await store.set(key, { lagAlert: prev.lagAlert, errorAlert: prev.errorAlert, fetchFail: true });
    return alerts;
  }

  const isLagging = result.lag !== null && result.lag > SYNC_LAG_THRESHOLD;
  const hasErrors = result.hasIndexingErrors;

  // Lag state transition
  if (isLagging && !prev.lagAlert) {
    alerts.push(`🔴 ${result.name}: lagging ${formatLag(result.lag)} blocks (chain: ${result.chainHead}, subgraph: ${result.subgraphBlock})`);
  } else if (!isLagging && prev.lagAlert) {
    alerts.push(`🟢 ${result.name}: sync recovered (lag: ${formatLag(result.lag)})`);
  }

  // Error state transition
  if (hasErrors && !prev.errorAlert) {
    alerts.push(`⚠️ ${result.name}: indexing errors detected`);
  } else if (!hasErrors && prev.errorAlert) {
    alerts.push(`🟢 ${result.name}: indexing errors cleared`);
  }

  // Fetch recovery
  if (prev.fetchFail) {
    alerts.push(`🟢 ${result.name}: fetch recovered`);
  }

  await store.set(key, {
    lagAlert: isLagging,
    errorAlert: hasErrors,
    fetchFail: false,
    lastLag: result.lag,
    lastCheck: new Date().toISOString(),
  });

  return alerts;
}

async function runSyncChecks(endpoints, concurrency = 10) {
  const allAlerts = [];
  const results = [];

  // Process in batches to avoid overwhelming RPC endpoints
  for (let i = 0; i < endpoints.length; i += concurrency) {
    const batch = endpoints.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(checkSync));

    for (const result of batchResults) {
      results.push(result);
      const alerts = await updateSyncAlertState(result);
      allAlerts.push(...alerts);
    }
  }

  return { results, alerts: allAlerts };
}

async function getSyncStatus(name) {
  const state = await store.get(`sync:alert:${name}`);
  if (!state) return { status: "unknown", lag: null };

  if (state.fetchFail) return { status: "error", lag: null };
  if (state.lagAlert) return { status: "lagging", lag: state.lastLag };
  if (state.errorAlert) return { status: "indexing-error", lag: state.lastLag };
  return { status: "ok", lag: state.lastLag };
}

export {
  checkSync,
  runSyncChecks,
  getSyncStatus,
  formatLag,
  resolveEndpointUrl,
  getChainHead,
  getSubgraphBlock,
};
