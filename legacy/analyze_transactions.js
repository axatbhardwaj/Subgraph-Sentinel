const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'kpi_metrics_log.json');
const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));

console.log('Timestamp\t\tSubgraph\tIndexer\t\tValue\tFlags');
console.log('-'.repeat(110));

// Track previous value and indexer per subgraph to catch drops or indexer flips
const prevByName = {};
let indexerChanges = 0;
let failures = 0;

for (const entry of logs) {
  const ts = entry.timestamp.slice(0, 19);
  if (!entry.details) continue;

  for (const d of entry.details) {
    const idx = d.indexer || 'unknown';
    const idxShort = (idx || '').slice(0, 10) + '..';

    const flags = [];
    if (!d.success) {
      failures++;
      flags.push('❌ FAIL');
    } else {
      // Detect indexer rotation
      if (prevByName[d.name]?.indexer && prevByName[d.name].indexer !== idx) {
        const prevShort = prevByName[d.name].indexer.slice(0, 10) + '..';
        flags.push(`🔄 ${prevShort}→${idxShort}`);
        indexerChanges++;
      }
      // Detect decreases for the same subgraph
      if (typeof d.value === 'number' && typeof prevByName[d.name]?.value === 'number') {
        if (d.value < prevByName[d.name].value) flags.push('⚠️ ↓');
      }
    }

    const flagStr = flags.join(' ');
    const valueStr = d.value !== undefined ? d.value.toString() : '-';
    console.log(`${ts}\t${d.name.padEnd(16)}\t${idxShort.padEnd(14)}\t${valueStr}\t${flagStr}`);

    if (d.success) {
      prevByName[d.name] = { value: d.value, indexer: idx };
    }
  }
}

console.log('\n=== Summary ===');
console.log(`Entries processed: ${logs.length}`);
console.log(`Indexer changes:   ${indexerChanges}`);
console.log(`Failures:          ${failures}`);
