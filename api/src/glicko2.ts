// Glicko-2 (Glickman 2013) — single-step rating update.
// Mirror of /lib/glicko2.js; keep math in sync.
//
// Reference: http://www.glicko.net/glicko/glicko2.pdf
//
// Defaults: τ = 0.5 (system constant), RD₀ = 350, σ₀ = 0.06, rating₀ = 1500.

const TAU = 0.5;
const EPSILON = 1e-6;
const SCALE = 173.7178; // 400 / ln(10)

export const RATING_INIT = 1500;
export const RD_INIT = 350;
export const SIGMA_INIT = 0.06;

export interface Rating {
  rating: number;
  rd: number;
  sigma: number;
}

export interface Opponent {
  rating: number;
  rd: number;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function newSigma(sigma: number, phi: number, v: number, delta: number, tau: number): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
    return num / den - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
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

export function rateOne(
  player: Rating,
  opponents: Opponent[],
  outcomes: number[],
  opts?: { tau?: number },
): Rating {
  const tau = opts && typeof opts.tau === 'number' ? opts.tau : TAU;

  if (!opponents.length) {
    const phi = player.rd / SCALE;
    const phiStar = Math.sqrt(phi * phi + player.sigma * player.sigma);
    return { rating: player.rating, rd: phiStar * SCALE, sigma: player.sigma };
  }

  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.sigma;

  const ops = opponents.map(o => ({
    mu: (o.rating - 1500) / SCALE,
    phi: o.rd / SCALE,
  }));

  let invV = 0;
  for (let i = 0; i < ops.length; i++) {
    const gj = g(ops[i].phi);
    const Ej = E(mu, ops[i].mu, ops[i].phi);
    invV += gj * gj * Ej * (1 - Ej);
  }
  const v = 1 / invV;

  let delta = 0;
  for (let i = 0; i < ops.length; i++) {
    const gj = g(ops[i].phi);
    const Ej = E(mu, ops[i].mu, ops[i].phi);
    delta += gj * (outcomes[i] - Ej);
  }
  delta *= v;

  const sigmaPrime = newSigma(sigma, phi, v, delta, tau);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  let muPrimeSum = 0;
  for (let i = 0; i < ops.length; i++) {
    const gj = g(ops[i].phi);
    const Ej = E(mu, ops[i].mu, ops[i].phi);
    muPrimeSum += gj * (outcomes[i] - Ej);
  }
  const muPrime = mu + phiPrime * phiPrime * muPrimeSum;

  return {
    rating: muPrime * SCALE + 1500,
    rd: phiPrime * SCALE,
    sigma: sigmaPrime,
  };
}
