# Security & threat model

A short, working document for The 2028 Ballot. Updated when defenses
change.

## Threat model

The app is a public anonymous webapp with one mutation path (POST
`/api/vote`, `/api/ballot`, `/api/event`). The realistic threats:

| # | Threat                                         | Severity | Likelihood |
| - | ---------------------------------------------- | -------- | ---------- |
| 1 | Casual scripted vote stuffing for one candidate | High     | High       |
| 2 | Coordinated brigading from one community/region | High     | Medium     |
| 3 | Bot scraping `/api/stats` to harvest aggregates | Low      | Medium     |
| 4 | DDoS via large POST volumes                    | High     | Low        |
| 5 | Replay of `/api/ballot` to inflate Borda scores | Medium   | Medium     |
| 6 | Privacy leak via the admin endpoints           | High     | Low        |
| 7 | Roster tampering via candidate-id injection    | Medium   | Medium     |

Out of model: state-actor traffic shaping, full DDoS (rely on
Cloudflare's edge), supply-chain attacks on `wrangler` itself.

## Defenses

**Server-side validation** (Phase 2+) — every mutating endpoint
validates input before touching D1:
- Candidate IDs must be in the canonical 40-name set
  (`api/src/candidates.ts`, mirrored from `candidates.js`).
- Ballot length = 5, no duplicates, no overlap between picks and
  extended.
- Country: 2-char alpha from `request.cf.country` (not user-supplied).
- `picked` ∈ {a, b}.
- Mitigates: #1 (partial — limits payload shape), #7 (full).

**Turnstile invisible captcha** (Phase 5, optional) — server checks the
token via Cloudflare's siteverify on every POST. Frontend includes the
token transparently. If `TURNSTILE_SECRET` isn't set on the Worker the
gate degrades to a pass-through (dev mode).
- Mitigates: #1, partially #2 (botted distributed accounts still bypass).

**Per-IP-hash daily rate limiter** (Phase 5, optional) — Workers KV
slot keyed by `sha256(cf-connecting-ip + DAILY_SALT + YYYY-MM-DD)`.
Limits: 50 votes / 10 ballots / 200 events per IP per UTC day. If `KV`
isn't bound, the gate is pass-through.
- Mitigates: #1, partial #2 (community brigading from many IPs still
  passes), partial #4.

**Cloudflare-edge protection** (always on) — DoS scrubbing, bot
fingerprinting at the L7 firewall, regional throttles.
- Mitigates: #4.

**Admin-endpoint hardening** — `/api/admin/*` is bearer-token gated via
the `ADMIN_TOKEN` Worker secret. If unset, every admin endpoint
returns 503 (fail closed). The admin response *never* includes raw
IPs or session ids — only ip-hashes that rotate daily and per-country
aggregates.
- Mitigates: #6.

**Anonymous data shape** — no IPs, session ids, or user-agents stored
in `ballots`. Only `picks`, optional `extended`, country, and
`created_at`. `pair_aggregates` and `candidate_country_score` are
sums, not row-per-event.
- Mitigates: PII leak fallout from any compromise.

## Known limitations

- **Borda inflation via fast ballots.** A bad actor with 10
  ballots-per-day limit and 10 IPs can still post 100 ballots/day.
  Mitigated only by Turnstile.
- **State-level community brigading.** If 50,000 voters in one country
  share a vote one direction, the country leaderboard genuinely
  shifts. This is *intended product behavior* (it's a "what does X
  think" tool), not an attack to defend against. Surface this in copy
  on the results screen ("Aggregates reflect who shares the app, not
  who votes in real elections.")
- **Pair-key enumeration.** A scraper can enumerate every
  `/api/stats?a=X&b=Y` (40 × 39 / 2 = 780 combinations) to mirror the
  whole dataset. Aggregates are public by design; this is a feature,
  not a leak.
- **Replay risk on `/api/ballot`.** No idempotency key. The same
  client could spam-submit 10 ballots/day (per IP-hash rate limit).
  Mitigated by Turnstile + rate limit; acceptable at v1.

## Roster-tamper response plan

If a tampered roster value lands in production (e.g., a candidate id
appears in `candidates.js` that isn't in `api/src/candidates.ts`):
1. The server rejects all `/api/vote`, `/api/ballot`, `/api/event`
   payloads referencing the unknown id with 400.
2. The frontend logs a console warning but otherwise renders the new
   candidate locally — the Elo round still works, but the country
   leaderboard never sees the id.
3. Resolution: amend `api/src/candidates.ts` in the same PR as the
   frontend change (the spec requires roster changes be amendments,
   not content updates — see `specs/mission.md` principle 7).

## Audit checklist (run before any major roster change or new endpoint)

- [ ] All POST handlers call `antiAbuseGate()` before any D1 write.
- [ ] No handler trusts `country` from the request body — only
      `request.cf.country`.
- [ ] `ALLOWED_ORIGINS` in `api/src/util.ts` matches the live
      origins exactly (scheme + host).
- [ ] `ADMIN_TOKEN`, `TURNSTILE_SECRET`, `DAILY_SALT` are set as
      Worker secrets on production.
- [ ] `wrangler kv namespace create` was run and `wrangler.toml` has
      the `[[kv_namespaces]]` block uncommented with the right id.
- [ ] D1 migrations are caught up via
      `wrangler d1 migrations apply ranked-choice-db --remote`.
- [ ] `api/.dev.vars` is not committed (already in `.gitignore`).
