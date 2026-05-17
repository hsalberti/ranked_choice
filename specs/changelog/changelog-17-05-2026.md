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

### Deferred

- Phase 5 (anti-abuse) still pending: needs Turnstile site key from CF
  dashboard + `wrangler kv namespace create` for the rate-limit slot.
- Phase 6 (polish + observability) still pending: Lighthouse audit,
  OG image generator, Logpush.

### Production deploy checklist (carried over to the next session)

1. `cd api && wrangler login` (interactive)
2. `wrangler d1 create ranked-choice-db` → paste UUID into
   `api/wrangler.toml` under `[[d1_databases]] database_id`
3. `wrangler d1 migrations apply ranked-choice-db --remote`
4. `wrangler deploy` → note the resulting `*.workers.dev` URL; if it
   doesn't match `ranked-choice-api.alberti-rick.workers.dev`, update
   the prod constant in `app.js` `API_BASE_URL` and commit
5. `gh secret set CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` so
   CI redeploys on push
