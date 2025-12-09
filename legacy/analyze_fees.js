const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'response_log.json');
const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));

console.log('Timestamp\t\t\tIndexer\t\t\ttotalFeesIn\tLegacyMech\tMarketPlace\tFlags');
console.log('-'.repeat(120));

let prev = null;
let prevIndexer = null;
let indexerChanges = 0;

for (const entry of logs) {
  const g = entry.data?.global;
  if (!g) continue;
  
  const ts = entry.timestamp.slice(0, 19);
  const indexer = entry.indexer || 'unknown';
  const indexerShort = indexer.slice(0, 10) + '..';
  
  // Convert to readable format (divide by 1e18 for ETH)
  const feesIn = (BigInt(g.totalFeesIn) / BigInt(1e18)).toString();
  const legacy = (BigInt(g.totalFeesInLegacyMech) / BigInt(1e18)).toString();
  const market = (BigInt(g.totalFeesInLegacyMechMarketPlace) / BigInt(1e18)).toString();
  
  let flags = [];
  
  // Check for indexer change
  if (prevIndexer && indexer !== prevIndexer) {
    const prevShort = prevIndexer.slice(0, 10) + '..';
    flags.push(`🔄 ${prevShort} → ${indexerShort}`);
    indexerChanges++;
  }
  
  // Check for decreases (potential issue)
  if (prev) {
    if (BigInt(g.totalFeesIn) < BigInt(prev.totalFeesIn)) flags.push('⚠️ FEES↓');
    if (BigInt(g.totalFeesInLegacyMech) < BigInt(prev.totalFeesInLegacyMech)) flags.push('⚠️ LEGACY↓');
    if (BigInt(g.totalFeesInLegacyMechMarketPlace) < BigInt(prev.totalFeesInLegacyMechMarketPlace)) flags.push('⚠️ MARKET↓');
  }
  
  const flagStr = flags.length ? flags.join(' ') : '';
  console.log(`${ts}\t${indexerShort.padEnd(14)}\t${feesIn}\t\t${legacy}\t\t${market}\t\t${flagStr}`);
  
  prev = g;
  prevIndexer = indexer;
}

console.log('\n=== Summary ===');
console.log(`Indexer changes detected: ${indexerChanges}`);
