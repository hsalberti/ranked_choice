// Endpoint handlers. Each takes (request, env, origin) and returns a
// Response. The router in index.ts owns CORS preflight + method check
// before dispatching.

import { ALL_IDS, isCandidateId, isHeadlineId } from './candidates';
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

  try {
    await env.DB.prepare(`
      INSERT INTO pair_aggregates (pair_key, country, picked_id, votes)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(pair_key, country, picked_id)
      DO UPDATE SET votes = votes + 1
    `).bind(key, country, body.picked).run();
  } catch (err) {
    return serverError(String(err), origin);
  }
  return new Response(null, { status: 204 });
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

    const local: Record<string, number> = { [a]: 0, [b]: 0 };
    for (const row of localRes.results) {
      if (row.picked_id === a || row.picked_id === b) {
        local[row.picked_id] = Number(row.votes) || 0;
      }
    }
    const global: Record<string, number> = { [a]: 0, [b]: 0 };
    for (const row of globalRes.results) {
      if (row.picked_id === a || row.picked_id === b) {
        global[row.picked_id] = Number(row.votes) || 0;
      }
    }

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
    if (!isHeadlineId(p)) return badRequest('picks_invalid_id', origin);
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

// ----- Admin endpoints (Phase 5) -------------------------------------
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
