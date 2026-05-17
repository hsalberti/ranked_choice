# 2026-05-17

## v1.1 — Backend live (Phase 1.5 + 2 + 3 + 4)

The Cloudflare Worker that was scaffolded yesterday is now feature-complete
for the next four roadmap phases. All endpoints pass an end-to-end smoke
test against `wrangler dev` + local SQLite-backed D1. Production deploy
still pending the user-side `wrangler login` + `wrangler d1 create`.

### Marked done

- **Phase 1.5 — Candidate detail cards & engagement tracking.**
  - Frontend already shipped 2026-05-16 (card flip + bottom-sheet +
    localStorage event queue with `EVENT_FLUSH_URL = null` gate).
  - Today: `POST /api/event` handler ships against the
    `candidate_events` D1 table; frontend's `EVENT_FLUSH_URL` is now
    derived from `API_BASE_URL` so the queue drains as soon as the
    Worker is reachable.
- **Phase 2 — Vote ingestion + country-filtered overlay.**
  - Migration `0001_pair_aggregates.sql`.
  - `POST /api/vote` (validation + canonical pair_key + per-country
    counter) and `GET /api/stats?a=X&b=Y` (local + global splits).
  - Frontend's `showStatOverlay()` now races the seeded estimate
    against the real `/api/stats` call; if it arrives within the
    1.45s overlay window and total ≥ 5 votes, percentages, headline,
    and "based on N votes in {country}" footer get swapped in.
  - Pre-emptive +1 on the user's pick handles the race against their
    own POST /api/vote.
- **Phase 3 — Ballot submission + country leaderboard.**
  - Migrations `0003_ballots.sql` + `0004_candidate_country_score.sql`.
  - `POST /api/ballot` (Borda-weighted 5/4/3/2/1 into
    `candidate_country_score`), `GET /api/ballot/:id`,
    `GET /api/leaderboard/:country`.
  - Frontend persists each ballot, swaps the share URL from
    `?b=a,b,c,d,e` to `?b=<short-id>`; friend deep-links resolve via
    `/api/ballot/:id` (legacy inline format still parsed for
    backward compat).
  - Results screen now renders a "Top 5 in your country" panel.
- **Phase 4 — Ballot-vs-country comparison.**
  - `GET /api/comparison/:country` with per-rank share.
  - Frontend renders an "Agree with 🇧🇷 on N/5 picks" note under the
    country leaderboard.

### Spec amendments

None. The endpoints + schemas match `specs/tech-stack.md` exactly.

### Filed to inbox

Nothing this run.

## v1.2 — Phase 5 + Phase 6 partials

Continued in the same session. Phase 5 backend gate is complete in
code; Phase 6 ships the OG image endpoint, the Web Analytics stub,
and a CI smoke test step.

### Marked done

- **Phase 5 — Anti-abuse hardening** *(partial)*. Server-side
  `antiAbuseGate()` wraps every POST: Turnstile siteverify (when
  `TURNSTILE_SECRET` is set) + Workers KV per-IP-hash daily slot
  (when `KV` is bound) + bearer-token admin endpoints with
  fail-closed semantics. Frontend Turnstile glue lands gated on
  a `<meta name="turnstile-sitekey">` tag. Threat-model doc in
  `specs/security.md`. Outstanding human-side work: get a Turnstile
  site key from the CF dashboard, run `wrangler kv namespace
  create RATE_LIMIT`, set the matching `wrangler secret put`
  values. Admin endpoint via bearer token instead of CF Access for
  v1.
- **Phase 6 — Polish + observability** *(partial)*. New
  `GET /api/og/:ballot_id` returns a 1200×630 SVG poster, cached at
  the edge. Default + dynamic `og:image` meta tags in `index.html`,
  with JS rewriting the dynamic URL when opening a friend deep
  link. Manual smoke test via `scripts/test_api.sh` covers
  `/api/health`, `/api/stats`, `/api/leaderboard/BR` and the rest of
  the surface — gates the release rather than the deploy.

### Spec amendments

None this run.

### Filed to inbox

Nothing this run.

### Deferred

- Phase 5: Turnstile site key + KV namespace creation (CF dashboard).
- Phase 6: Cloudflare Web Analytics beacon token, Logpush to R2.
- Phase 7 (Beyond MVP) still parked until demand signal.

## v1.1 → v1.2 verification helper

`scripts/test_api.sh` was added in v1.2. Run against the local Worker
or a deployed URL to validate the whole HTTP contract (37 assertions
covering CORS, validation, pair-key canonicalization, Borda math,
admin auth, routing) in one shot.

### Production deploy checklist (carried over to the next session)

1. `cd api && wrangler login` (interactive)
2. `wrangler d1 create ranked-choice-db` → paste UUID into
   `api/wrangler.toml` under `[[d1_databases]] database_id`
3. `wrangler d1 migrations apply ranked-choice-db --remote`
4. `wrangler deploy` → note the resulting `*.workers.dev` URL; if it
   doesn't match `ranked-choice-api.bardeus.workers.dev`, update the
   prod constant in `app.js` `API_BASE_URL` and commit.
5. Set up Cloudflare "Connect Git" on the Worker for auto-redeploy on
   push to `main` (Workers & Pages → Settings → Build).

---

## v2 — Smart matchups + Crowd ELO (in progress)

OpenSpec change `smart-matchups-crowd-elo` applied today. Roster restructured
into three opt-in tiers (15/12/13). Glicko-2 (Glickman 2013) replaces plain ELO;
matchup selection now opens with Vance vs. Newsom, follows with a hand-picked
same-party rival (Vance→Rubio, Newsom→AOC), and from R3+ runs 70% close-rated /
30% random with a coverage floor. Tier 1 stop condition: top-5 with non-overlapping
90% CIs OR 18-vote cap (simulation: cap binds in 100% of runs at current tuning).

Backend: migration `0005_candidate_country_elo.sql`, `POST /api/vote` extended to
incrementally update per-(candidate, country) Glicko ratings, new
`GET /api/elo?country=XX&party=R|D|I|all&limit=N` endpoint with min-N gating
(`ELO_MIN_N` env var, default 20). Ballot pick validation relaxed from
`HEADLINE_IDS` (25) to `ALL_IDS` (40) so Tier-2/3 candidates can legitimately
land in top-5.

Frontend: refocused results screen on the personal ballot (top-5 + Wordle grid +
Copy / Post-to-X / native-share buttons + "See global stats →" CTA). New
`#screen-stats` view, reachable only from the results screen, exposes per-country
crowd ELO with party + country filter chips. Tier-progression CTA cycles "Keep
voting · 12 more" → "Go deeper · 13 more" → hidden.

### Shipped today (post-implementation)
- ✅ Migration applied to prod D1 (`0005_candidate_country_elo.sql`).
- ✅ Worker deployed to `ranked-choice-api.bardeus.workers.dev`
  (version `249b7f4d`). Note: the prior changelog assumed
  `*.alberti-rick.workers.dev`, but that hostname never resolved —
  `bardeus` is the actual subdomain. `app.js` `API_BASE_URL` updated.
- ✅ Smoke test against prod: 41/41 green
  (`bash scripts/test_api.sh https://ranked-choice-api.bardeus.workers.dev`).

### Still user-side
- Lighthouse re-check on mobile (target 95+ across).
- Manual play verification of openers (Vance vs. Newsom → R2 same-party).
- 24h prod 5xx watch.

### Open tuning questions (deferred)
- Stop-condition CI threshold (currently 90%). Simulation shows it never fires
  before the 18-vote cap — consider lowering to 80% (`z=1.282`) or reducing
  Tier-1 `topN` from 5 to 3 if we want early-stop to be meaningful.
- `ELO_MIN_N=20` is a starting guess; revisit after a week of real traffic.
- Adaptive 70/30 split is fine to A/B post-launch (range 0.5–0.85).
- `DYNAMIC_OPENER` stays `false` in v1 — flip on after `candidate_country_elo`
  has > 1000 ballots per major country and the leaderboard stabilizes.

## v3 — Tier list + civic explainer

Per OpenSpec change `tier-list-view`. TierMaker-style tier rows (S/A/B/C,
plus D and F at larger sizes) rendered from either Global crowd Elo or
this session's personal Glicko ratings. Mounted inline on the results
screen (lazy via IntersectionObserver) and as a standalone screen at
`#/tiers`. Includes a 1200×630 client-side PNG export with watermark, a
civic-explainer panel (Elo math + ranked-choice voting basics, neutral
tone), and a clickable `(i)` icon next to "Your top 5" on results.
Zero backend changes; zero new runtime deps.
