#!/usr/bin/env node
// Unit tests for lib/tier_cut.js
//
// Asserts:
// 1. Bucket sums equal the size value exactly for each supported size.
// 2. Slicing is position-only (does not look at Elo values).
// 3. Each candidate appears in exactly one tier and in the same order
//    as the input ranking.
// 4. Two identical inputs produce identical outputs (determinism).
// 5. Unsupported sizes and short inputs throw.

const { cutTiers, SHAPES } = require('../lib/tier_cut.js');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

// Build a sample ranked list of 40 placeholder candidates with fake elo.
const ranked = Array.from({ length: 40 }, (_, i) => ({
  id: `c${String(i + 1).padStart(2, '0')}`,
  elo: 2000 - i * 5,
}));

console.log('\n\x1b[1m== Bucket sums equal size ==\x1b[0m');
for (const size of [15, 25, 40]) {
  const out = cutTiers(ranked.slice(0, size), size);
  const total = Object.values(out).reduce((acc, arr) => acc + arr.length, 0);
  check(`size ${size}: total = ${total}`, total === size, `expected ${size}`);
  // Per-tier expected counts.
  for (const [tier, expectedCount] of Object.entries(SHAPES[size])) {
    check(`  ${tier} = ${out[tier].length}`, out[tier].length === expectedCount, `expected ${expectedCount}`);
  }
}

console.log('\n\x1b[1m== Slicing is position-only (Elo-blind) ==\x1b[0m');
// Reverse the elo direction but keep the same input order; output must match.
const rankedFlat = ranked.slice(0, 15).map((c, i) => ({ id: c.id, elo: 1500 }));
const outA = cutTiers(ranked.slice(0, 15), 15);
const outB = cutTiers(rankedFlat, 15);
let posOk = true;
for (const tier of ['S', 'A', 'B', 'C']) {
  for (let i = 0; i < outA[tier].length; i++) {
    if (outA[tier][i].id !== outB[tier][i].id) { posOk = false; break; }
  }
  if (!posOk) break;
}
check('identical positions ignore Elo value', posOk);

console.log('\n\x1b[1m== Each candidate appears exactly once, in input order ==\x1b[0m');
{
  const out = cutTiers(ranked, 40);
  const flat = ['S', 'A', 'B', 'C', 'D', 'F'].flatMap(t => out[t]);
  const ids = flat.map(c => c.id);
  const inputIds = ranked.map(c => c.id);
  check('count = 40', flat.length === 40);
  check('ids unique', new Set(ids).size === 40);
  check('order preserved', ids.join(',') === inputIds.join(','));
}

console.log('\n\x1b[1m== Determinism ==\x1b[0m');
{
  const a = cutTiers(ranked.slice(0, 25), 25);
  const b = cutTiers(ranked.slice(0, 25), 25);
  check('same input → same output', JSON.stringify(a) === JSON.stringify(b));
}

console.log('\n\x1b[1m== Error cases ==\x1b[0m');
let threw = false;
try { cutTiers(ranked.slice(0, 15), 17); } catch (e) { threw = true; }
check('unsupported size throws', threw);

threw = false;
try { cutTiers(ranked.slice(0, 10), 15); } catch (e) { threw = true; }
check('short input throws', threw);

threw = false;
try { cutTiers('not an array', 15); } catch (e) { threw = true; }
check('non-array input throws', threw);

console.log('');
if (failures === 0) {
  console.log('\x1b[32mAll tier-cut checks passed.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m${failures} check${failures === 1 ? '' : 's'} failed.\x1b[0m`);
  process.exit(1);
}
