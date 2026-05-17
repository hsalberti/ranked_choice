/* Glicko-2 (Glickman 2013) — single-step rating update.
 *
 * Browser-side usage:  <script src="lib/glicko2.js"></script>  →  window.Glicko2.rateOne(...)
 * Server-side usage:   keep this file in sync with api/src/glicko2.ts (same math).
 *
 * Reference: http://www.glicko.net/glicko/glicko2.pdf
 *
 * Defaults: τ = 0.5 (system constant), RD₀ = 350, σ₀ = 0.06, rating₀ = 1500.
 *
 * The "rateOne" entry point updates a single player against a list of opponents,
 * each with their pre-period rating + RD, given match outcomes (1 = player won,
 * 0 = player lost, 0.5 = draw). Returns the updated { rating, rd, sigma }.
 *
 * For a single matchup we call rateOne twice — once for each player against the
 * other as a single opponent. That avoids needing to batch a "rating period."
 */
(function () {
  const TAU = 0.5;                  // system constant (typical 0.3..1.2)
  const EPSILON = 1e-6;             // convergence threshold for σ' iteration
  const SCALE = 173.7178;           // 400 / ln(10) — the Glicko-1 → Glicko-2 unit scale

  function g(phi) {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }
  function E(mu, mu_j, phi_j) {
    return 1 / (1 + Math.exp(-g(phi_j) * (mu - mu_j)));
  }

  // Step 5 — illinois algorithm to solve f(x) = 0 for new σ'.
  function newSigma(sigma, phi, v, delta, tau) {
    const a = Math.log(sigma * sigma);
    const f = (x) => {
      const ex = Math.exp(x);
      const num = ex * (delta * delta - phi * phi - v - ex);
      const den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
      return num / den - (x - a) / (tau * tau);
    };
    let A = a;
    let B;
    if (delta * delta > phi * phi + v) {
      B = Math.log(delta * delta - phi * phi - v);
    } else {
      let k = 1;
      while (f(a - k * tau) < 0) k += 1;
      B = a - k * tau;
    }
    let fA = f(A);
    let fB = f(B);
    while (Math.abs(B - A) > EPSILON) {
      const C = A + ((A - B) * fA) / (fB - fA);
      const fC = f(C);
      if (fC * fB <= 0) {
        A = B; fA = fB;
      } else {
        fA = fA / 2;
      }
      B = C; fB = fC;
    }
    return Math.exp(A / 2);
  }

  /**
   * Single Glicko-2 step for one player.
   * @param {object} player  { rating, rd, sigma }
   * @param {Array} opponents [{ rating, rd }, ...]
   * @param {Array<number>} outcomes [1|0|0.5, ...]  same length as opponents
   * @param {object} [opts]  { tau? }
   * @returns {{ rating: number, rd: number, sigma: number }}
   */
  function rateOne(player, opponents, outcomes, opts) {
    const tau = (opts && typeof opts.tau === 'number') ? opts.tau : TAU;

    // No games this period — only RD inflates.
    if (!opponents.length) {
      const phi = player.rd / SCALE;
      const sigma = player.sigma;
      const phiStar = Math.sqrt(phi * phi + sigma * sigma);
      return {
        rating: player.rating,
        rd: phiStar * SCALE,
        sigma,
      };
    }

    // Step 2 — convert player and opponents to Glicko-2 scale.
    const mu = (player.rating - 1500) / SCALE;
    const phi = player.rd / SCALE;
    const sigma = player.sigma;

    const ops = opponents.map(o => ({
      mu: (o.rating - 1500) / SCALE,
      phi: o.rd / SCALE,
    }));

    // Step 3 — compute v (estimated variance).
    let invV = 0;
    for (let i = 0; i < ops.length; i++) {
      const gj = g(ops[i].phi);
      const Ej = E(mu, ops[i].mu, ops[i].phi);
      invV += gj * gj * Ej * (1 - Ej);
    }
    const v = 1 / invV;

    // Step 4 — compute Δ (estimated improvement in rating).
    let delta = 0;
    for (let i = 0; i < ops.length; i++) {
      const gj = g(ops[i].phi);
      const Ej = E(mu, ops[i].mu, ops[i].phi);
      delta += gj * (outcomes[i] - Ej);
    }
    delta *= v;

    // Step 5 — compute new σ'.
    const sigmaPrime = newSigma(sigma, phi, v, delta, tau);

    // Step 6 — update φ to φ*.
    const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);

    // Step 7 — compute new φ' and new μ'.
    const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    let muPrimeSum = 0;
    for (let i = 0; i < ops.length; i++) {
      const gj = g(ops[i].phi);
      const Ej = E(mu, ops[i].mu, ops[i].phi);
      muPrimeSum += gj * (outcomes[i] - Ej);
    }
    const muPrime = mu + phiPrime * phiPrime * muPrimeSum;

    // Step 8 — convert back to Glicko-1 scale.
    return {
      rating: muPrime * SCALE + 1500,
      rd: phiPrime * SCALE,
      sigma: sigmaPrime,
    };
  }

  // 90% confidence interval half-width: rating ± 1.645 × RD.
  function ci90(rd) { return 1.645 * rd; }

  const API = { rateOne, ci90, TAU, SCALE };
  if (typeof window !== 'undefined') window.Glicko2 = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
