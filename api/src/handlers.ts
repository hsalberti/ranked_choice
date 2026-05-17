// Endpoint handlers. Each takes (request, env, origin) and returns a
// Response. The router in index.ts owns CORS preflight + method check
// before dispatching.

import { ALL_IDS, PARTY_OF, isCandidateId } from './candidates';
import { rateOne, RATING_INIT, RD_INIT, SIGMA_INIT } from './glicko2';
import {
  Env,
  antiAbuseGate,
  badRequest,
  countryOf,
  json,
  notFound,
  pairKey,
  randomBallotId,
  serverError,
  todayUTC,
} from './util';

// ----- GET /api/health -----------------------------------------------

export async function handleHealth(
  request: Request,
  _env: Env,
  origin: string | null,
): Promise<Response> {
  return json({ ok: true, country: countryOf(request) }, 200, origin);
}

// ----- POST /api/event -----------------------------------------------
//
// Body: { events: [{ candidate_id, event_type, context }, …] }
// Increments aggregate counts in candidate_events for the visitor's
// country + today's UTC date. Best-effort; loss is acceptable.

const EVENT_TYPES = new Set([
  'flip_open', 'flip_close', 'link_twitter', 'link_wikipedia',
]);
const CONTEXTS = new Set(['matchup', 'results']);

interface EventInput {
  candidate_id: unknown;
  event_type: unknown;
  context: unknown;
}

export async function handleEvent(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  let body: { events?: EventInput[]; t?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('invalid_json', origin);
  }
  const blocked = await antiAbuseGate(request, env, 'event', body?.t, origin);
  if (blocked) return blocked;
  const events = Array.isArray(body?.events) ? body.events : null;
  if (!events) return badRequest('events_required', origin);
  if (events.length === 0) return new Response(null, { status: 204 });
  if (events.length > 100) return badRequest('events_too_many', origin);

  const country = countryOf(request);
  const day = todayUTC();

  // Aggregate in-memory so duplicate events in the same batch collapse
  // into one UPDATE statement.
  const acc = new Map<string, number>();
  for (const e of events) {
    if (!isCandidateId(e.candidate_id)) continue;
    if (typeof e.event_type !== 'string' || !EVENT_TYPES.has(e.event_type)) continue;
    if (typeof e.context !== 'string' || !CONTEXTS.has(e.context)) continue;
    const key = `${e.candidate_id}\x1f${e.event_type}\x1f${e.context}`;
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }

  if (acc.size === 0) return new Response(null, { status: 204 });

  const stmts: D1PreparedStatement[] = [];
  for (const [key, count] of acc) {
    const [candidate_id, event_type, context] = key.split('\x1f');
    stmts.push(
      env.DB.prepare(`
        INSERT INTO candidate_events
          (candidate_id, event_type, context, country, day, count)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(candidate_id, event_type, context, country, day)
        DO UPDATE SET count = count + excluded.count
      `).bind(candidate_id, event_type, context, country, day, count),
    );
  }
  try {
    await env.DB.batch(stmts);
  } catch (err) {
    return serverError(String(err), origin);
  }
  return new Response(null, { status: 204 });
}

// ----- POST /api/vote ------------------------------------------------
//
// Body: { a, b, picked }
// Increments the (pair_key, country, picked) row in pair_aggregates.

interface VoteInput {
  a: unknown;
  b: unknown;
  picked: unknown;
  t?: string;
}

export async function handleVote(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  let body: VoteInput;
  try {
    body = await request.json();
  } catch {
    return badRequest('invalid_json', origin);
  }
  const blocked = await antiAbuseGate(request, env, 'vote', body.t, origin);
  if (blocked) return blocked;
  if (!isCandidateId(body.a)) return badRequest('a_invalid', origin);
  if (!isCandidateId(body.b)) return badRequest('b_invalid', origin);
  if (body.a === body.b) return badRequest('a_b_equal', origin);
  if (!isCandidateId(body.picked)) return badRequest('picked_invalid', origin);
  if (body.picked !== body.a && body.picked !== body.b) {
    return badRequest('picked_not_in_pair', origin);
  }

  const country = countryOf(request);
  const key = pairKey(body.a, body.b);
  const pickedId = body.picked;
  const lostId = pickedId === body.a ? body.b : body.a;

  try {
    // (1) Existing per-pair aggregate (powers the stats overlay).
    const pairWrite = env.DB.prepare(`
      INSERT INTO pair_aggregates (pair_key, country, picked_id, votes)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(pair_key, country, picked_id)
      DO UPDATE SET votes = votes + 1
    `).bind(key, country, pickedId);

    // (2) v2: Glicko-2 update for both (candidate, country) rows.
    // Read snapshot, apply one step, UPSERT both rows atomically.
    const eloRows = await env.DB.prepare(`
      SELECT candidate_id, elo, rd, sigma, n_ballots
      FROM candidate_country_elo
      WHERE country = ? AND candidate_id IN (?, ?)
    `).bind(country, pickedId, lostId).all<{
      candidate_id: string; elo: number; rd: number; sigma: number; n_ballots: number;
    }>();

    const seed = (id: string) => ({
      candidate_id: id, elo: RATING_INIT, rd: RD_INIT, sigma: SIGMA_INIT, n_ballots: 0,
    });
    const byCand = new Map(eloRows.results.map(r => [r.candidate_id, r]));
    const cur = {
      picked: byCand.get(pickedId) ?? seed(pickedId),
      lost:   byCand.get(lostId)   ?? seed(lostId),
    };
    const newPicked = rateOne(
      { rating: cur.picked.elo, rd: cur.picked.rd, sigma: cur.picked.sigma },
      [{ rating: cur.lost.elo, rd: cur.lost.rd }],
      [1],
    );
    const newLost = rateOne(
      { rating: cur.lost.elo, rd: cur.lost.rd, sigma: cur.lost.sigma },
      [{ rating: cur.picked.elo, rd: cur.picked.rd }],
      [0],
    );
    const now = Date.now();
    const upsert = (id: string, r: { rating: number; rd: number; sigma: number }, n: number) =>
      env.DB.prepare(`
        INSERT INTO candidate_country_elo
          (candidate_id, country, elo, rd, sigma, n_ballots, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(candidate_id, country)
        DO UPDATE SET
          elo = excluded.elo,
          rd = excluded.rd,
          sigma = excluded.sigma,
          n_ballots = excluded.n_ballots,
          updated_at = excluded.updated_at
      `).bind(id, country, r.rating, r.rd, r.sigma, n, now);

    await env.DB.batch([
      pairWrite,
      upsert(pickedId, newPicked, cur.picked.n_ballots + 1),
      upsert(lostId,   newLost,   cur.lost.n_ballots + 1),
    ]);
  } catch (err) {
    return serverError(String(err), origin);
  }
  return new Response(null, { status: 204 });
}

// ----- GET /api/elo --------------------------------------------------
//
// Query params:
//   country   ISO-2 uppercase, or 'GLOBAL' (default)
//   party     R | D | I | all  (default 'all')
//   limit     1..50            (default 25)
// Response: JSON array of { id, elo, rd, n_ballots, party }, sorted by
// elo DESC. Country views apply a min-N filter (env.ELO_MIN_N, default 20);
// GLOBAL aggregates across all countries (no min-N gate).

const PARTY_VALUES = new Set(['R', 'D', 'I', 'all']);

export async function handleElo(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const country = (url.searchParams.get('country') || 'GLOBAL').toUpperCase();
  const party = url.searchParams.get('party') || 'all';
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 25;

  if (country !== 'GLOBAL' && !/^[A-Z]{2}$/.test(country)) {
    return badRequest('invalid_country', origin);
  }
  if (!PARTY_VALUES.has(party)) return badRequest('invalid_party', origin);
  if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
    return badRequest('invalid_limit', origin);
  }

  const minN = env.ELO_MIN_N ? parseInt(env.ELO_MIN_N, 10) : 20;

  interface Row { candidate_id: string; elo: number; rd: number; n_ballots: number; }

  try {
    let rows: Row[];
    if (country === 'GLOBAL') {
      // Weighted average ELO across countries: Σ(elo · n) / Σ(n).
      const res = await env.DB.prepare(`
        SELECT candidate_id,
               SUM(elo * n_ballots) * 1.0 / SUM(n_ballots) AS elo,
               MIN(rd) AS rd,
               SUM(n_ballots) AS n_ballots
        FROM candidate_country_elo
        WHERE n_ballots > 0
        GROUP BY candidate_id
      `).all<Row>();
      rows = res.results;
    } else {
      const res = await env.DB.prepare(`
        SELECT candidate_id, elo, rd, n_ballots
        FROM candidate_country_elo
        WHERE country = ? AND n_ballots >= ?
      `).bind(country, minN).all<Row>();
      rows = res.results;
    }

    // Single filter: PARTY_OF gates both unknown-id rejection and the
    // party query param (when not 'all').
    const filtered = rows
      .filter(r => {
        const p = PARTY_OF[r.candidate_id];
        return p !== undefined && (party === 'all' || p === party);
      })
      .map(r => ({
        id: r.candidate_id,
        elo: r.elo,
        rd: r.rd,
        n_ballots: r.n_ballots,
        party: PARTY_OF[r.candidate_id],
      }))
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);

    return json(filtered, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

// ----- GET /api/stats?a=X&b=Y ----------------------------------------
//
// Response: { country, local: { [id]: n }, global: { [id]: n }, total: { local, global } }
// `local` is the visitor's country; `global` is every country summed.

interface CountRow {
  picked_id: string;
  votes: number;
}

export async function handleStats(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const a = url.searchParams.get('a');
  const b = url.searchParams.get('b');
  if (!isCandidateId(a)) return badRequest('a_invalid', origin);
  if (!isCandidateId(b)) return badRequest('b_invalid', origin);
  if (a === b) return badRequest('a_b_equal', origin);

  const country = countryOf(request);
  const key = pairKey(a, b);

  try {
    const localQuery = env.DB.prepare(`
      SELECT picked_id, votes FROM pair_aggregates
      WHERE pair_key = ? AND country = ?
    `).bind(key, country);
    const globalQuery = env.DB.prepare(`
      SELECT picked_id, SUM(votes) AS votes FROM pair_aggregates
      WHERE pair_key = ?
      GROUP BY picked_id
    `).bind(key);
    const [localRes, globalRes] = await env.DB.batch<CountRow>([localQuery, globalQuery]);

    // pair_key WHERE clause restricts picked_id to {a, b}; POST /api/vote
    // validates picked ∈ {a, b} before insert, so no further guard needed.
    const local: Record<string, number> = { [a]: 0, [b]: 0 };
    for (const row of localRes.results) local[row.picked_id] = row.votes;
    const global: Record<string, number> = { [a]: 0, [b]: 0 };
    for (const row of globalRes.results) global[row.picked_id] = row.votes;

    return json({
      country,
      pair_key: key,
      local,
      global,
      total: {
        local: local[a] + local[b],
        global: global[a] + global[b],
      },
    }, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

// ----- POST /api/ballot ----------------------------------------------
//
// Body: { picks: [5 ids], extended?: [optional ids] }
// Persists the ballot, Borda-scores the top-5 into
// candidate_country_score, returns { id, country }.

const BORDA_WEIGHTS = [5, 4, 3, 2, 1] as const;

interface BallotInput {
  picks: unknown;
  extended?: unknown;
  t?: string;
}

export async function handleBallotPost(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  let body: BallotInput;
  try {
    body = await request.json();
  } catch {
    return badRequest('invalid_json', origin);
  }
  const blocked = await antiAbuseGate(request, env, 'ballot', body.t, origin);
  if (blocked) return blocked;
  if (!Array.isArray(body.picks)) return badRequest('picks_required', origin);
  if (body.picks.length !== 5) return badRequest('picks_length', origin);

  const picks: string[] = [];
  for (const p of body.picks) {
    // v2: any candidate may end up in top-5, since opted-in Tier-2/3
    // votes refine ratings that feed into the shared ranking.
    if (!isCandidateId(p)) return badRequest('picks_invalid_id', origin);
    if (picks.includes(p)) return badRequest('picks_duplicate', origin);
    picks.push(p);
  }

  let extended: string[] | null = null;
  if (Array.isArray(body.extended)) {
    extended = [];
    for (const p of body.extended) {
      if (!isCandidateId(p)) return badRequest('extended_invalid_id', origin);
      if (picks.includes(p) || extended.includes(p)) {
        return badRequest('extended_overlap', origin);
      }
      extended.push(p);
    }
    if (extended.length === 0) extended = null;
  }

  const country = countryOf(request);
  const createdAt = Date.now();
  const id = randomBallotId();

  const insertBallot = env.DB.prepare(`
    INSERT INTO ballots (id, picks, extended, country, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, picks.join(','), extended ? extended.join(',') : null, country, createdAt);

  const scoreUpdates = picks.map((candidate, i) =>
    env.DB.prepare(`
      INSERT INTO candidate_country_score (country, candidate, weighted, appearances)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(country, candidate)
      DO UPDATE SET
        weighted = weighted + excluded.weighted,
        appearances = appearances + 1
    `).bind(country, candidate, BORDA_WEIGHTS[i]),
  );

  try {
    await env.DB.batch([insertBallot, ...scoreUpdates]);
  } catch (err) {
    return serverError(String(err), origin);
  }
  return json({ id, country }, 200, origin);
}

// ----- GET /api/ballot/:id -------------------------------------------

interface BallotRow {
  picks: string;
  extended: string | null;
  country: string;
  created_at: number;
}

export async function handleBallotGet(
  _request: Request,
  env: Env,
  origin: string | null,
  id: string,
): Promise<Response> {
  if (!/^[0-9a-z]{4,32}$/.test(id)) return badRequest('id_invalid', origin);
  try {
    const row = await env.DB.prepare(`
      SELECT picks, extended, country, created_at FROM ballots WHERE id = ?
    `).bind(id).first<BallotRow>();
    if (!row) return notFound(origin);
    return json({
      id,
      picks: row.picks.split(','),
      extended: row.extended ? row.extended.split(',') : null,
      country: row.country,
      created_at: row.created_at,
    }, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

// ----- GET /api/leaderboard/:country ---------------------------------
//
// Top-5 by weighted Borda for the country.

interface ScoreRow {
  candidate: string;
  weighted: number;
  appearances: number;
}

export async function handleLeaderboard(
  _request: Request,
  env: Env,
  origin: string | null,
  country: string,
): Promise<Response> {
  if (!/^[A-Z]{2}$/.test(country)) return badRequest('country_invalid', origin);
  try {
    const res = await env.DB.prepare(`
      SELECT candidate, weighted, appearances
      FROM candidate_country_score
      WHERE country = ?
      ORDER BY weighted DESC, candidate ASC
      LIMIT 5
    `).bind(country).all<ScoreRow>();
    const totalRow = await env.DB.prepare(`
      SELECT COUNT(*) AS n FROM ballots WHERE country = ?
    `).bind(country).first<{ n: number }>();
    return json({
      country,
      top5: res.results.map(r => ({
        id: r.candidate,
        score: r.weighted,
        appearances: r.appearances,
      })),
      n: Number(totalRow?.n ?? 0),
    }, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

// ----- GET /api/comparison/:country ----------------------------------
//
// Country's top-5 plus per-rank score share (weighted as a fraction
// of the rank's total possible Borda contribution = 5 × ballots).

export async function handleComparison(
  _request: Request,
  env: Env,
  origin: string | null,
  country: string,
): Promise<Response> {
  if (!/^[A-Z]{2}$/.test(country)) return badRequest('country_invalid', origin);
  try {
    const top = await env.DB.prepare(`
      SELECT candidate, weighted, appearances
      FROM candidate_country_score
      WHERE country = ?
      ORDER BY weighted DESC, candidate ASC
      LIMIT 5
    `).bind(country).all<ScoreRow>();
    const totalRow = await env.DB.prepare(`
      SELECT COUNT(*) AS n FROM ballots WHERE country = ?
    `).bind(country).first<{ n: number }>();
    const n = Number(totalRow?.n ?? 0);
    const denom = Math.max(1, n) * 5; // max possible Borda contribution per slot
    return json({
      country,
      country_top5: top.results.map(r => ({
        id: r.candidate,
        score: r.weighted,
        share: r.weighted / denom,
        appearances: r.appearances,
      })),
      country_total: n,
    }, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

// ----- GET /api/og/:ballot_id ----------------------------------------
//
// Returns a 1200×630 SVG poster of a ballot, suitable as an OpenGraph
// preview. Inline SVG dodges the no-headless-Chrome limitation of
// Workers; modern social platforms accept SVG as og:image.

const PARTY_FILL: Record<string, string> = {
  R: '#c8242e',
  D: '#1a4e8a',
  I: '#6b6b73',
};

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const ID_TO_NAME: Record<string, string> = {
  ramaswamy: 'Vivek Ramaswamy', booker: 'Cory Booker', desantis: 'Ron DeSantis',
  buttigieg: 'Pete Buttigieg', scott: 'Tim Scott', ossoff: 'Jon Ossoff',
  rfk: 'Robert F. Kennedy Jr.', cuban: 'Mark Cuban', carlson: 'Tucker Carlson',
  stefanik: 'Elise Stefanik', mace: 'Nancy Mace', aoc: 'Alexandria Ocasio-Cortez',
  vance: 'J.D. Vance', newsom: 'Gavin Newsom', gaetz: 'Matt Gaetz',
  talarico: 'James Talarico', rubio: 'Marco Rubio', harris: 'Kamala Harris',
  hegseth: 'Pete Hegseth', moore: 'Wes Moore', cruz: 'Ted Cruz',
  shapiro: 'Josh Shapiro', greene: 'Marjorie Taylor Greene',
  klobuchar: 'Amy Klobuchar', bannon: 'Steve Bannon',
  pritzker: 'J.B. Pritzker', sanders_sh: 'Sarah Huckabee Sanders',
  abbott: 'Greg Abbott', kemp: 'Brian Kemp', youngkin: 'Glenn Youngkin',
  burgum: 'Doug Burgum', gabbard: 'Tulsi Gabbard', paul: 'Rand Paul',
  kelly: 'Mark Kelly', vanhollen: 'Chris Van Hollen', smith_sa: 'Stephen A. Smith',
  trumpjr: 'Donald Trump Jr.', emanuel: 'Rahm Emanuel',
  raimondo: 'Gina Raimondo', landrieu: 'Mitch Landrieu',
};
const ID_TO_PARTY: Record<string, 'R' | 'D' | 'I'> = {
  ramaswamy: 'R', booker: 'D', desantis: 'R', buttigieg: 'D', scott: 'R',
  ossoff: 'D', rfk: 'I', cuban: 'I', carlson: 'R', stefanik: 'R',
  mace: 'R', aoc: 'D', vance: 'R', newsom: 'D', gaetz: 'R',
  talarico: 'D', rubio: 'R', harris: 'D', hegseth: 'R', moore: 'D',
  cruz: 'R', shapiro: 'D', greene: 'R', klobuchar: 'D', bannon: 'R',
  pritzker: 'D', sanders_sh: 'R', abbott: 'R', kemp: 'R', youngkin: 'R',
  burgum: 'R', gabbard: 'R', paul: 'R', kelly: 'D', vanhollen: 'D',
  smith_sa: 'D', trumpjr: 'R', emanuel: 'D', raimondo: 'D', landrieu: 'D',
};

export async function handleOgImage(
  _request: Request,
  env: Env,
  origin: string | null,
  id: string,
): Promise<Response> {
  if (!/^[0-9a-z]{4,32}$/.test(id)) return badRequest('id_invalid', origin);
  try {
    const row = await env.DB.prepare(`
      SELECT picks, country FROM ballots WHERE id = ?
    `).bind(id).first<{ picks: string; country: string }>();
    if (!row) return notFound(origin);
    const picks = row.picks.split(',').slice(0, 5);
    const rows = picks.map((id, i) => {
      const name = ID_TO_NAME[id] || id;
      const party = ID_TO_PARTY[id] || 'I';
      const fill = PARTY_FILL[party];
      const y = 230 + i * 70;
      return `
        <g transform="translate(120 ${y})">
          <circle cx="22" cy="22" r="22" fill="${fill}" opacity="0.92" />
          <text x="22" y="29" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle"
                font-family="-apple-system, Helvetica, Arial">${i + 1}</text>
          <text x="70" y="34" font-size="30" font-weight="600" fill="#0b0b0d"
                font-family="-apple-system, Helvetica, Arial">${escXml(name)}</text>
        </g>`;
    }).join('');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f7f8" />
  <text x="120" y="100" font-size="24" letter-spacing="6" font-weight="700" fill="#6b6b73"
        font-family="-apple-system, Helvetica, Arial">THE 2028 BALLOT</text>
  <text x="120" y="170" font-size="56" font-weight="700" fill="#0b0b0d"
        font-family="-apple-system, Helvetica, Arial">Their top 5 for 2028</text>
  ${rows}
  <text x="120" y="590" font-size="20" fill="#6b6b73"
        font-family="-apple-system, Helvetica, Arial">Build yours · 2028ballot.almaintel.com</text>
</svg>`;
    return new Response(svg, {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=3600',
        ...corsHeadersForImage(origin),
      },
    });
  } catch (err) {
    return serverError(String(err), origin);
  }
}

function corsHeadersForImage(origin: string | null): Record<string, string> {
  // Images can be embedded cross-origin without CORS, but we still
  // include allow-origin so the asset is fetchable by JS if needed.
  return {
    'access-control-allow-origin': '*',
    vary: 'origin',
  };
}

// ----- Admin endpoints -----------------------------------------------
//
// Bearer-token gated. If ADMIN_TOKEN isn't set on the deployed Worker,
// all admin endpoints return 503 — fail-closed so a misconfigured prod
// can't leak data.

function checkAdminAuth(request: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return false;
  // Constant-time-ish: lengths differ → quick reject; else compare char-by-char.
  const a = m[1];
  const b = env.ADMIN_TOKEN;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handleAdminOverview(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  if (!checkAdminAuth(request, env)) {
    return json({ error: 'unauthorized' }, env.ADMIN_TOKEN ? 401 : 503, origin);
  }
  try {
    const today = todayUTC();
    const sevenAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
    const [votes, ballots, events, votes7d, ballots7d] = await env.DB.batch<{ n: number }>([
      env.DB.prepare(`SELECT COALESCE(SUM(votes),0) AS n FROM pair_aggregates`),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM ballots`),
      env.DB.prepare(`SELECT COALESCE(SUM(count),0) AS n FROM candidate_events`),
      env.DB.prepare(`SELECT COALESCE(SUM(votes),0) AS n FROM pair_aggregates`),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM ballots WHERE created_at >= ?`).bind(Date.now() - 7 * 86400 * 1000),
    ]);
    const countries = await env.DB.prepare(`
      SELECT country, COUNT(*) AS n FROM ballots GROUP BY country ORDER BY n DESC LIMIT 25
    `).all<{ country: string; n: number }>();
    return json({
      today,
      seven_days_ago: sevenAgo,
      totals: {
        votes: Number(votes.results[0]?.n ?? 0),
        ballots: Number(ballots.results[0]?.n ?? 0),
        events: Number(events.results[0]?.n ?? 0),
      },
      last_7d: {
        votes_estimate: Number(votes7d.results[0]?.n ?? 0),
        ballots: Number(ballots7d.results[0]?.n ?? 0),
      },
      ballots_by_country: countries.results,
    }, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

export async function handleAdminTopPairs(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  if (!checkAdminAuth(request, env)) {
    return json({ error: 'unauthorized' }, env.ADMIN_TOKEN ? 401 : 503, origin);
  }
  try {
    const res = await env.DB.prepare(`
      SELECT pair_key, SUM(votes) AS total FROM pair_aggregates
      GROUP BY pair_key
      ORDER BY total DESC
      LIMIT 20
    `).all<{ pair_key: string; total: number }>();
    return json({ pairs: res.results }, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

export async function handleAdminLeaderboards(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  if (!checkAdminAuth(request, env)) {
    return json({ error: 'unauthorized' }, env.ADMIN_TOKEN ? 401 : 503, origin);
  }
  try {
    const res = await env.DB.prepare(`
      WITH ranked AS (
        SELECT
          country,
          candidate,
          weighted,
          appearances,
          ROW_NUMBER() OVER (PARTITION BY country ORDER BY weighted DESC, candidate ASC) AS rk
        FROM candidate_country_score
      )
      SELECT country, candidate, weighted, appearances, rk
      FROM ranked WHERE rk <= 5
      ORDER BY country, rk
    `).all<{ country: string; candidate: string; weighted: number; appearances: number; rk: number }>();
    // Group results by country
    const byCountry: Record<string, Array<{ id: string; score: number; appearances: number }>> = {};
    for (const r of res.results) {
      (byCountry[r.country] ||= []).push({ id: r.candidate, score: r.weighted, appearances: r.appearances });
    }
    return json({ leaderboards: byCountry }, 200, origin);
  } catch (err) {
    return serverError(String(err), origin);
  }
}

// ----- helper exposed for unit tests ---------------------------------
export const _internal = {
  ALL_IDS,
  BORDA_WEIGHTS,
};
