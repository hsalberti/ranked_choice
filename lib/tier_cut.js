/* Tier-cut — split a pre-ranked candidate list into named tier rows.
 *
 * Pure function. Does not look at Elo values; slices by position only,
 * so two viewers with the same `ranked` order + `size` always see the
 * same tier groupings. The tier-list-view spec depends on that property.
 *
 * Sizes (sums must equal exactly):
 *   15 → S=2 A=3 B=4 C=6
 *   25 → S=2 A=3 B=5 C=7 D=8
 *   40 → S=2 A=3 B=5 C=7 D=8 F=15
 *
 * Browser-side: <script src="lib/tier_cut.js"></script> → window.TierCut.cutTiers
 * Node-side:    require('../lib/tier_cut.js').cutTiers
 */
(function () {
  const SHAPES = {
    15: { S: 2, A: 3, B: 4, C: 6 },
    25: { S: 2, A: 3, B: 5, C: 7, D: 8 },
    40: { S: 2, A: 3, B: 5, C: 7, D: 8, F: 15 },
  };

  function cutTiers(ranked, size) {
    const shape = SHAPES[size];
    if (!shape) throw new Error(`cutTiers: unsupported size ${size}; expected 15 | 25 | 40`);
    if (!Array.isArray(ranked)) throw new Error('cutTiers: ranked must be an array');
    if (ranked.length < size) {
      throw new Error(`cutTiers: ranked has ${ranked.length} entries; need at least ${size}`);
    }
    const out = {};
    let i = 0;
    for (const [tier, n] of Object.entries(shape)) {
      out[tier] = ranked.slice(i, i + n);
      i += n;
    }
    return out;
  }

  const API = { cutTiers, SHAPES };
  if (typeof window !== 'undefined') window.TierCut = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
