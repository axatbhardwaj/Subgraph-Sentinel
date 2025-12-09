const toBig = (v) => BigInt(v ?? 0);

const formatEth = (wei) => {
  const val = toBig(wei);
  const whole = val / 10n ** 18n;
  const frac = (val % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${frac}`;
};

const formatInt = (v) => Number.parseInt(v ?? 0, 10).toLocaleString("en");
const formatPct = (v) => `${(v * 100).toFixed(2)}%`;

const drop = (curr, prev) => curr < prev;

function feeAlerts(current, prev, indexer, prevIndexer) {
  const alerts = [];
  if (prev && drop(toBig(current.totalFeesIn), toBig(prev.totalFeesIn))) {
    alerts.push(`Fees↓ ${formatEth(prev.totalFeesIn)} → ${formatEth(current.totalFeesIn)}`);
  }
  if (prev && drop(toBig(current.totalFeesInLegacyMech), toBig(prev.totalFeesInLegacyMech))) {
    alerts.push(
      `Legacy↓ ${formatEth(prev.totalFeesInLegacyMech)} → ${formatEth(current.totalFeesInLegacyMech)}`
    );
  }
  if (
    prev &&
    drop(toBig(current.totalFeesInLegacyMechMarketPlace), toBig(prev.totalFeesInLegacyMechMarketPlace))
  ) {
    alerts.push(
      `Market↓ ${formatEth(prev.totalFeesInLegacyMechMarketPlace)} → ${formatEth(
        current.totalFeesInLegacyMechMarketPlace
      )}`
    );
  }
  if (prevIndexer && indexer && prevIndexer !== indexer) {
    alerts.push(`Indexer rotated ${prevIndexer} → ${indexer}`);
  }
  return alerts;
}

function kpiValue(data, type) {
  if (type === "ATA") return Number.parseInt(data.globals?.[0]?.totalAtaTransactions ?? "0", 10);
  if (type === "FEES_USD") return Number.parseFloat(data.global?.totalFeesInUSD ?? "0");
  return Number.parseInt(data.global?.txCount ?? "0", 10);
}

function kpiAlerts(name, value, prevValue, indexer, prevIndexer) {
  const alerts = [];
  if (Number.isFinite(prevValue) && value < prevValue) {
    alerts.push(`${name}: value fell ${formatInt(prevValue)} → ${formatInt(value)}`);
  }
  if (prevIndexer && indexer && prevIndexer !== indexer) {
    alerts.push(`${name}: indexer rotated ${prevIndexer} → ${indexer}`);
  }
  return alerts;
}

export { formatEth, formatInt, formatPct, feeAlerts, kpiAlerts, kpiValue };

