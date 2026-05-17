// Small helpers shared across handlers.

export interface Env {
  DB: D1Database;
  // Phase 5+:
  // KV: KVNamespace;
  // TURNSTILE_SECRET: string;
  // DAILY_SALT: string;
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
