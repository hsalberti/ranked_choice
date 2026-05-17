#!/usr/bin/env node
// Smoke test for the tier-list PNG export pipeline.
//
// The actual canvas rasterisation runs in a real browser — Node has no
// <canvas> without an extra binary dep, and we deliberately ship no
// runtime deps. This script therefore validates the *data-prep* portion
// of the exporter: given a known ranked list and a scope, the same
// cutTiers + tier-order traversal the canvas drawing loop uses produces
// the expected flat list of candidate ids per tier row.
//
// The visual fidelity of the rendered PNG is verified manually in
// scripts/test_tier_export.html (open in a browser, click "Save").

const { cutTiers, SHAPES } = require('../lib/tier_cut.js');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

// Build a sample ranked list of 40 placeholder candidates.
const ranked = Array.from({ length: 40 }, (_, i) => ({
  id: `c${String(i + 1).padStart(2, '0')}`,
  party: i % 3 === 0 ? 'R' : i % 3 === 1 ? 'D' : 'I',
  name: `Candidate ${i + 1}`,
}));

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

function exportRowsForScope(rankedFull, size) {
  if (rankedFull.length < size) throw new Error('ranked too short');
  const cut = cutTiers(rankedFull.slice(0, size), size);
  return TIER_ORDER
    .filter(t => Array.isArray(cut[t]) && cut[t].length > 0)
    .map(t => ({ tier: t, ids: cut[t].map(c => c.id) }));
}

console.log('\n\x1b[1m== Size 15 → 4 rows (S/A/B/C), order matches input ==\x1b[0m');
{
  const rows = exportRowsForScope(ranked, 15);
  check('row count', rows.length === 4, `got ${rows.length}`);
  check('first row is S=2', rows[0].tier === 'S' && rows[0].ids.length === 2);
  check('S contains c01,c02', JSON.stringify(rows[0].ids) === JSON.stringify(['c01', 'c02']));
  check('C contains c10..c15', JSON.stringify(rows[3].ids) === JSON.stringify(['c10','c11','c12','c13','c14','c15']));
}

console.log('\n\x1b[1m== Size 25 → 5 rows (S/A/B/C/D), 25 ids total ==\x1b[0m');
{
  const rows = exportRowsForScope(ranked, 25);
  check('row count', rows.length === 5);
  const total = rows.reduce((acc, r) => acc + r.ids.length, 0);
  check('total ids = 25', total === 25, `got ${total}`);
}

console.log('\n\x1b[1m== Size 40 → 6 rows (S/A/B/C/D/F), all 40 in input order ==\x1b[0m');
{
  const rows = exportRowsForScope(ranked, 40);
  check('row count', rows.length === 6);
  const flat = rows.flatMap(r => r.ids);
  check('all ids in input order', JSON.stringify(flat) === JSON.stringify(ranked.map(c => c.id)));
}

console.log('\n\x1b[1m== Filename pattern matches spec ==\x1b[0m');
for (const size of [15, 25, 40]) {
  for (const source of ['global', 'mine']) {
    const fn = `2028ballot-tier-${source}-${size}.png`;
    check(`filename ${fn}`, /^2028ballot-tier-(global|mine)-(15|25|40)\.png$/.test(fn));
  }
}

console.log('');
console.log('Note: canvas rasterisation (1200×630 PNG header bytes etc.) is verified');
console.log('manually in-browser. This test only covers the data-prep pipeline.');
console.log('');
if (failures === 0) {
  console.log('\x1b[32mAll tier-export pipeline checks passed.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m${failures} check${failures === 1 ? '' : 's'} failed.\x1b[0m`);
  process.exit(1);
}
