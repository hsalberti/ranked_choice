#!/usr/bin/env node
// Roster assertion: every candidate has a tier; counts are 15/12/13.
// Run: node scripts/test_roster.js
//
// Loads candidates.js by sourcing it into a stub `window`, then walks
// the combined CANDIDATES + EXTENDED_CANDIDATES pool.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'candidates.js'), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);

const C = ctx.window.CANDIDATES || [];
const EC = ctx.window.EXTENDED_CANDIDATES || [];
const all = [...C, ...EC];

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
    failures += 1;
  }
}

console.log('\n\x1b[1m== Roster tier assertion ==\x1b[0m');

check(all.length === 40, `roster has 40 entries (got ${all.length})`);

const byTier = { 1: [], 2: [], 3: [] };
const untagged = [];
for (const c of all) {
  if (c.tier === 1 || c.tier === 2 || c.tier === 3) {
    byTier[c.tier].push(c.id);
  } else {
    untagged.push(c.id);
  }
}

check(untagged.length === 0, `every entry has tier ∈ {1,2,3} (untagged: ${untagged.join(', ') || 'none'})`);
check(byTier[1].length === 15, `Tier 1 = 15 (got ${byTier[1].length})`);
check(byTier[2].length === 12, `Tier 2 = 12 (got ${byTier[2].length})`);
check(byTier[3].length === 13, `Tier 3 = 13 (got ${byTier[3].length})`);

const expectedT1 = [
  'vance', 'rubio', 'desantis', 'cruz', 'carlson', 'rfk', 'trumpjr',
  'newsom', 'harris', 'buttigieg', 'aoc', 'shapiro', 'moore', 'booker', 'pritzker',
];
const missingT1 = expectedT1.filter(id => !byTier[1].includes(id));
check(missingT1.length === 0, `Tier 1 contains expected top cohort (missing: ${missingT1.join(', ') || 'none'})`);

console.log('\n\x1b[1m== R2_RIVAL ==\x1b[0m');
const R2 = ctx.window.R2_RIVAL;
check(typeof R2 === 'object' && R2 !== null, 'R2_RIVAL exported');
if (R2) {
  check(R2.vance === 'rubio', 'R2_RIVAL.vance === "rubio"');
  check(R2.newsom === 'aoc', 'R2_RIVAL.newsom === "aoc"');
  const keys = Object.keys(R2);
  check(keys.length === 2, `R2_RIVAL has exactly 2 keys (got ${keys.length}: ${keys.join(', ')})`);
}

console.log('');
if (failures === 0) {
  console.log('\x1b[32mAll checks passed.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m${failures} check${failures === 1 ? '' : 's'} failed.\x1b[0m`);
  process.exit(1);
}
