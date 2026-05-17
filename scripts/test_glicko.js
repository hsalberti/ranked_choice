#!/usr/bin/env node
// Glickman (2013) reference test vectors. Player at 1500 / RD 200 / σ 0.06
// faces three opponents in one rating period:
//   opp1: 1400 / 30, outcome 1 (win)
//   opp2: 1550 / 100, outcome 0 (loss)
//   opp3: 1700 / 300, outcome 0 (loss)
// Expected after one update (per the paper, τ=0.5):
//   rating ≈ 1464.06
//   rd     ≈ 151.52
//   σ      ≈ 0.05999  (essentially unchanged)
//
// Tolerances are loose (0.5 on rating, 0.5 on RD) to absorb floating-point
// drift across JS engines.

const G = require('../lib/glicko2.js');

const player    = { rating: 1500, rd: 200, sigma: 0.06 };
const opponents = [
  { rating: 1400, rd: 30 },
  { rating: 1550, rd: 100 },
  { rating: 1700, rd: 300 },
];
const outcomes = [1, 0, 0];

const out = G.rateOne(player, opponents, outcomes);

let failures = 0;
function approx(name, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= tol;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}: got ${actual.toFixed(4)}, expected ≈ ${expected} (tol ${tol})`);
  if (!ok) failures += 1;
}

console.log('\n\x1b[1m== Glickman (2013) reference vectors ==\x1b[0m');
approx('rating', out.rating, 1464.06, 0.5);
approx('rd',     out.rd,     151.52, 0.5);
approx('sigma',  out.sigma,  0.05999, 0.001);

console.log('\n\x1b[1m== Empty opponents — RD inflates, rating + σ unchanged ==\x1b[0m');
const idle = G.rateOne(player, [], []);
approx('rating (no games)', idle.rating, 1500, 0.001);
approx('sigma (no games)',  idle.sigma,  0.06, 0.001);
const okRdInflate = idle.rd > player.rd;
console.log(`  ${okRdInflate ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} rd inflated: got ${idle.rd.toFixed(4)} > prior ${player.rd}`);
if (!okRdInflate) failures += 1;

console.log('');
if (failures === 0) {
  console.log('\x1b[32mAll Glicko-2 checks passed.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m${failures} check${failures === 1 ? '' : 's'} failed.\x1b[0m`);
  process.exit(1);
}
