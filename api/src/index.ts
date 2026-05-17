// The 2028 Ballot — Cloudflare Worker entry point.
//
// Phase 1 (current): a single GET /api/health that echoes country from
// the Cloudflare-edge `request.cf.country` header. CORS is open to the
// frontend origins listed in ALLOWED_ORIGINS below.
//
// Phase 2+ adds the vote, stats, ballot, leaderboard, comparison, and
// event endpoints documented in specs/tech-stack.md.

export interface Env {
  // Bound in wrangler.toml [[d1_databases]]. Uncomment in Phase 2.
  // DB: D1Database;
  // KV: KVNamespace;
  // TURNSTILE_SECRET: string;
  // DAILY_SALT: string;
}

const ALLOWED_ORIGINS = new Set<string>([
  'https://hsalberti.github.io',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
  // TODO: add the production Cloudflare Pages origin here once the
  // custom domain is live.
]);

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      // `request.cf.country` is provided by Cloudflare's edge; falls back
      // to 'ZZ' when the lookup fails (very rare; localhost, some VPNs).
      const country = (request as RequestWithCf).cf?.country ?? 'ZZ';
      return json({ ok: true, country }, 200, origin);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'not_found' }, 404, origin);
    }

    return json({ error: 'not_found' }, 404, origin);
  },
};

// Workers ships its CF properties on the request object via the `cf`
// field; the typings live in @cloudflare/workers-types but we narrow
// here so the rest of the file stays portable.
interface RequestWithCf extends Request {
  cf?: { country?: string };
}
