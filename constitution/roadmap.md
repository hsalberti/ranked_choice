# Roadmap

Phased plan from the current static prototype to a country-aware
production site. Each phase is independently shippable — we can stop
at any boundary and still have a working product.

## Phase 0 — Static prototype ✅ (current)

Status: **shipped to `claude/ranked-choice-voting-app-bHP9m`**.

- Vanilla HTML/CSS/JS at the repo root.
- 25 candidates, Elo-style ranking, Wordle-shaped share text.
- Stats overlay is seeded by a deterministic hash — not real data.
- Deep links via `?b=…` URL parameter.
- Light + dark mode, keyboard navigation, mobile-first layout.

**Known gaps:** stats are simulated, no persistence across devices, no
country awareness, no abuse protection.

## Phase 1 — Cloudflare plumbing

Goal: get a real backend in place without changing visible behavior.

- Restructure repo into `/web`, `/api`, `/migrations`, `/constitution`.
- Create Cloudflare Pages project pointed at `/web` on `main`.
- Create Workers project under `/api` with `wrangler.toml`.
- Provision D1 database, register binding in `wrangler.toml`.
- GitHub Action: deploy `/web` to Pages and `/api` to Workers on push
  to `main`.
- `GET /api/health` returns `{ ok: true, country: request.cf.country }`.

**Exit criteria:** custom domain serves the existing frontend, and
`/api/health` returns the visitor's country from any device.

## Phase 2 — Vote ingestion + country-filtered overlay

Goal: the stats overlay shows real, country-aware numbers.

- D1 migration: `pair_aggregates` table.
- `POST /api/vote`: validate `{ a, b, picked }`, derive `pair_key`,
  increment counter for `(pair_key, country, picked)`.
- `GET /api/stats?a=X&b=Y`: read local (country) and global counts.
- Frontend: replace `fetchPairStats()` with a real `fetch` call.
  Fall back to the seeded estimate on network error so the UX never
  hangs.
- Update stats overlay copy: "In Brazil, 62% picked X. Globally, 55%."
- Add a small "based on N votes in your country" footer.

**Exit criteria:** voting on phone A makes the percentage move on
phone B (same country) within five seconds.

## Phase 3 — Ballot submission + country leaderboard

Goal: country-level top-5 visible at the results screen.

- D1 migrations: `ballots`, `candidate_country_score`.
- `POST /api/ballot`: persist the top-5, update Borda scores in
  `candidate_country_score`.
- `GET /api/leaderboard/:country`: top-5 candidates by weighted score.
- `GET /api/ballot/:id`: fetch a shared ballot by ID.
- Frontend: after results render, fetch "Top 5 in {country}" and
  render it in a panel below the user's top-5.
- Switch share links from `?b=ids` to `?b={ballot_id}` so the picks
  live server-side.

**Exit criteria:** finishing a ballot triggers a `/api/ballot` POST,
and the country leaderboard updates within a few seconds and matches
the count returned from D1.

## Phase 4 — Ballot-vs-country comparison

Goal: surface how a user agrees and disagrees with their country.

- `GET /api/comparison/:country`: country's top-5 with their per-rank
  score share.
- Frontend: side-by-side "You vs. {country}" panel on the results
  screen, highlighting overlaps (same name in both lists) and
  contrasts (in your top-5, not theirs).
- Extend the share preview to include a one-line "agree with
  {country}: 3/5" stat.

**Exit criteria:** comparison panel renders within 500ms after the
results screen mounts, and the totals match what `/api/leaderboard`
returns.

## Phase 5 — Anti-abuse hardening

Goal: make casual scripted abuse unprofitable.

- Integrate Turnstile (invisible mode) on `/api/vote` and `/api/ballot`.
- Workers KV rate limiter: 50 votes / 10 ballots per IP per day,
  keyed by `sha256(ip + DAILY_SALT)`.
- Server-side validation: candidate IDs against the canonical list,
  ballot length exactly 5, no duplicate picks, country length 2.
- Admin endpoint behind Cloudflare Access for a moderation dashboard
  (vote totals, suspect IPs by hash, top countries).
- Document the threat model and known limitations in
  `/constitution/security.md`.

**Exit criteria:** a scripted attack hitting `/api/vote` is throttled
within 50 requests and fails Turnstile on hit 51; admin dashboard
loads behind Access.

## Phase 6 — Polish + observability

Goal: production-grade readiness without scope creep.

- Cloudflare Web Analytics installed on Pages.
- Logpush from Workers → R2 with a 7-day retention.
- Lighthouse audit, target 95+ across all four categories on mobile.
- Open Graph image generator (Workers `og:image` endpoint) so shared
  links preview a stylized ballot card.
- Smoke-test E2E script in CI hitting `/api/health`, `/api/stats`,
  `/api/vote`, `/api/ballot` against a preview environment.
- Set up alerting (e.g. Slack webhook) when 5xx rate or KV write
  failures exceed thresholds.

**Exit criteria:** Lighthouse 95+ across the board, error budget green
for a full week, OG previews render on share.

## Phase 7 — Beyond MVP

Picked up only when there's demand signal from real usage.

- **Time windowing** — toggle aggregates between "this week" and "all
  time"; needs an extra date-bucket dimension in `pair_aggregates`.
- **Optional sign-in** — Google/Apple via Cloudflare Access or a
  third-party identity provider, only to save ballots cross-device.
- **Party-of-voter filter** — opt-in self-report, sliced into
  aggregates as a third dimension after country.
- **Embed widget** — `<script src=…>` that drops a one-matchup card
  on a publisher's article and links back to the full ballot.
- **Retrospective ballots** — past-cycle versions (2024, 2020) using
  the same engine for nostalgia + new-user funnel.
- **Multi-language** — Spanish + Portuguese first, since the country
  filter will surface non-US traffic quickly.

## Cross-cutting principles for every phase

- **Country filter is the headline.** Any UI surface that shows
  aggregate stats should expose country alongside global.
- **Anonymous stays the default.** Adding accounts is a future
  feature, never a gate.
- **No third-party trackers ever.** New analytics must be cookieless
  and first-party.
- **Free tier first.** Don't introduce a paid dependency without
  evidence it's needed at our current scale.
