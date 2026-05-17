// Small helpers shared across handlers.

export interface Env {
  DB: D1Database;
  // All of these are optional. The Worker degrades gracefully if any is
  // absent: no Turnstile = skip captcha check, no KV = skip rate limit,
  // no ADMIN_TOKEN = admin endpoints disabled.
  KV?: KVNamespace;
  TURNSTILE_SECRET?: string;
  DAILY_SALT?: string;
  ADMIN_TOKEN?: string;
  // v2 (smart-matchups-crowd-elo): min ballots per (candidate, country)
  // before a row shows in a country-specific /api/elo response. Default 20.
  ELO_MIN_N?: string;
}

export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  'https://2028ballot.almaintel.com',
  'https://hsalberti.github.io',
  'https://ranked-choice.alberti-rick.workers.dev',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

export function json(
  body: unknown,
  status: number,
  origin: string | null,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
      ...(extraHeaders ?? {}),
    },
  });
}

export function badRequest(reason: string, origin: string | null): Response {
  return json({ error: 'bad_request', reason }, 400, origin);
}

export function notFound(origin: string | null): Response {
  return json({ error: 'not_found' }, 404, origin);
}

export function methodNotAllowed(origin: string | null, allow: string): Response {
  return json({ error: 'method_not_allowed' }, 405, origin, { allow });
}

export function serverError(reason: string, origin: string | null): Response {
  return json({ error: 'server_error', reason }, 500, origin);
}

// Pair key matches frontend pairKey(): sorted, joined by '|'.
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const COUNTRY_RE = /^[A-Z]{2}$/;

// `request.cf.country` is provided by the Cloudflare edge. Localhost
// dev or unknown lookups get 'ZZ'.
export function countryOf(request: Request): string {
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  const raw = cf?.country;
  if (typeof raw === 'string' && COUNTRY_RE.test(raw)) return raw;
  return 'ZZ';
}

// 10-char URL-safe random ID for ballot links. Crockford-style alphabet
// (no i/l/o/u to reduce typo confusion). ~50 bits of entropy — fine
// for our collision risk at any plausible volume.
const BALLOT_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
export function randomBallotId(len = 10): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += BALLOT_ALPHABET[buf[i] % BALLOT_ALPHABET.length];
  }
  return s;
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '0.0.0.0';
}

export async function dailyIpHash(ip: string, salt: string): Promise<string> {
  const enc = new TextEncoder().encode(ip + '|' + salt + '|' + todayUTC());
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---- Turnstile verification ---------------------------------------
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// Returns true if the token is valid OR if Turnstile isn't configured
// (so the Worker still works in dev without it).
interface TurnstileResp { success?: boolean; }
export async function verifyTurnstile(
  token: string | undefined | null,
  ip: string,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret) return true; // dev mode / not configured
  if (!token) return false;
  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    if (!r.ok) return false;
    const j = await r.json() as TurnstileResp;
    return j.success === true;
  } catch {
    return false;
  }
}

// ---- KV rate limiting ---------------------------------------------
// Per-IP-hash daily slot. Stops casual scripted abuse without
// requiring any user-facing friction. Returns true if the request is
// within budget; false if it should be rejected.
export async function checkRateLimit(
  env: Env,
  ipHash: string,
  kind: 'vote' | 'ballot' | 'event',
  limits: { vote: number; ballot: number; event: number } = { vote: 50, ballot: 10, event: 200 },
): Promise<boolean> {
  if (!env.KV) return true; // not configured, allow
  const key = `rl:${kind}:${ipHash}`;
  const raw = await env.KV.get(key);
  const current = raw ? parseInt(raw, 10) : 0;
  if (Number.isNaN(current)) return true; // corrupted entry — fail open
  if (current >= limits[kind]) return false;
  // Best-effort write; expirationTtl scopes to ~24h.
  await env.KV.put(key, String(current + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

// ---- Anti-abuse gate ----------------------------------------------
// Convenience wrapper to call from every mutating handler.
export async function antiAbuseGate(
  request: Request,
  env: Env,
  kind: 'vote' | 'ballot' | 'event',
  token: string | undefined | null,
  origin: string | null,
): Promise<Response | null> {
  const ip = clientIp(request);
  const salt = env.DAILY_SALT || 'dev-salt-do-not-use-in-prod';
  const ipHash = await dailyIpHash(ip, salt);

  if (env.KV) {
    const ok = await checkRateLimit(env, ipHash, kind);
    if (!ok) return json({ error: 'rate_limited' }, 429, origin);
  }

  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET);
    if (!ok) return json({ error: 'turnstile_failed' }, 403, origin);
  }

  return null;
}
