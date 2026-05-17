// The 2028 Ballot — Cloudflare Worker entry point.
//
// Routes (current set; see specs/tech-stack.md for the contract):
//   GET    /api/health
//   POST   /api/event
//   POST   /api/vote
//   GET    /api/stats?a=X&b=Y
//   POST   /api/ballot
//   GET    /api/ballot/:id
//   GET    /api/leaderboard/:country
//   GET    /api/comparison/:country

import {
  handleAdminLeaderboards,
  handleAdminOverview,
  handleAdminTopPairs,
  handleBallotGet,
  handleBallotPost,
  handleComparison,
  handleEvent,
  handleHealth,
  handleLeaderboard,
  handleStats,
  handleVote,
} from './handlers';
import { Env, corsHeaders, methodNotAllowed, notFound } from './util';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const method = request.method;
    const path = url.pathname;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // /api/health
    if (path === '/api/health') {
      if (method === 'GET') return handleHealth(request, env, origin);
      return methodNotAllowed(origin, 'GET');
    }

    // /api/event
    if (path === '/api/event') {
      if (method === 'POST') return handleEvent(request, env, origin);
      return methodNotAllowed(origin, 'POST');
    }

    // /api/vote
    if (path === '/api/vote') {
      if (method === 'POST') return handleVote(request, env, origin);
      return methodNotAllowed(origin, 'POST');
    }

    // /api/stats
    if (path === '/api/stats') {
      if (method === 'GET') return handleStats(request, env, origin);
      return methodNotAllowed(origin, 'GET');
    }

    // /api/ballot         (POST only)
    if (path === '/api/ballot') {
      if (method === 'POST') return handleBallotPost(request, env, origin);
      return methodNotAllowed(origin, 'POST');
    }

    // /api/ballot/:id
    const ballotMatch = /^\/api\/ballot\/([0-9a-z]{4,32})$/.exec(path);
    if (ballotMatch) {
      if (method === 'GET') return handleBallotGet(request, env, origin, ballotMatch[1]);
      return methodNotAllowed(origin, 'GET');
    }

    // /api/leaderboard/:country
    const leaderMatch = /^\/api\/leaderboard\/([A-Z]{2})$/.exec(path);
    if (leaderMatch) {
      if (method === 'GET') return handleLeaderboard(request, env, origin, leaderMatch[1]);
      return methodNotAllowed(origin, 'GET');
    }

    // /api/comparison/:country
    const compMatch = /^\/api\/comparison\/([A-Z]{2})$/.exec(path);
    if (compMatch) {
      if (method === 'GET') return handleComparison(request, env, origin, compMatch[1]);
      return methodNotAllowed(origin, 'GET');
    }

    // Admin (bearer-token gated; see handlers.checkAdminAuth)
    if (path === '/api/admin/overview') {
      if (method === 'GET') return handleAdminOverview(request, env, origin);
      return methodNotAllowed(origin, 'GET');
    }
    if (path === '/api/admin/top-pairs') {
      if (method === 'GET') return handleAdminTopPairs(request, env, origin);
      return methodNotAllowed(origin, 'GET');
    }
    if (path === '/api/admin/leaderboards') {
      if (method === 'GET') return handleAdminLeaderboards(request, env, origin);
      return methodNotAllowed(origin, 'GET');
    }

    return notFound(origin);
  },
};
