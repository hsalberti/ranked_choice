## 1. Phase A — Roster split

- [x] 1.1 Add `tier: 1 | 2 | 3` field to every record in `candidates.js` (both `CANDIDATES` and `EXTENDED_CANDIDATES`).
- [x] 1.2 Promote `trumpjr` and `pritzker` from `EXTENDED_CANDIDATES` into the headline `CANDIDATES` array with `tier: 1`.
- [x] 1.3 Mark the other Tier-1 names in `CANDIDATES` with `tier: 1` (vance, rubio, desantis, cruz, carlson, rfk, newsom, harris, buttigieg, aoc, shapiro, moore, booker).
- [x] 1.4 Mark the remaining 12 originally-headline candidates with `tier: 2` (ramaswamy, scott, ossoff, cuban, stefanik, mace, gaetz, talarico, hegseth, greene, klobuchar, bannon).
- [x] 1.5 Mark all 13 remaining `EXTENDED_CANDIDATES` records with `tier: 3` (sanders_sh, abbott, kemp, youngkin, burgum, gabbard, paul, kelly, vanhollen, smith_sa, emanuel, raimondo, landrieu).
- [x] 1.6 Verify counts: Tier 1 = 15, Tier 2 = 12, Tier 3 = 13, total = 40 (unit assertion in `scripts/test_roster.js`).
- [x] 1.7 Update `buildMatchups()` in `app.js` to accept a `tier` parameter and filter by `tier`.
- [x] 1.8 Update `start()` / `startExtended()` to drive the engine by tier rather than by headline-vs-extended.
- [x] 1.9 Add a `startTier3()` (or generalize `startExtended()` to take a tier arg) for the "Go deeper" CTA.
- [ ] 1.10 Smoke-test on `wrangler pages dev`: start → Tier 1 → results → Keep voting (Tier 2) → results → Go deeper (Tier 3) → results.

## 2. Phase B — Smart matchup engine

- [x] 2.1 Write `scripts/test_glicko.js` with the Glickman reference test vectors (player at 1500/200 vs three opponents, expected post-update rating ≈ 1464.06 and RD ≈ 151.52).
- [x] 2.2 Implement Glicko-2 in `lib/glicko2.js` (vendored client + server module) with `rateOne(rating, rd, sigma, opponents, outcomes)` returning `{ rating, rd, sigma }`. Pass the test vectors from 2.1.
- [x] 2.3 Replace `applyElo()` in `app.js` with a Glicko-2 update that maintains `ratings[id]`, `rd[id]`, `sigma[id]` per candidate per tier.
- [x] 2.4 Add `R2_RIVAL = { vance: 'rubio', newsom: 'aoc' }` constant in `candidates.js`.
- [x] 2.5 Implement `pickNextMatchup(tier, voteHistory, ratings, rd, appearances)` in `app.js`:
  - [x] 2.5.1 Tier 1 round 1 → return `{ a: byId.vance, b: byId.newsom }`.
  - [x] 2.5.2 Tier 1 round 2 → use `R2_RIVAL[winner_of_round_1]` (fallback to adaptive if no entry).
  - [x] 2.5.3 Round 3+ → 70% close-rated pair, 30% random uniform among allowed pairs.
- [x] 2.6 Implement coverage-floor logic: reject any pair that would cause a 2nd appearance while some active-tier candidate has 0 appearances; substitute the higher-appearance candidate with an unseen one (prefer same party).
- [x] 2.7 Implement Glicko-2 stop condition: top-5 pairwise non-overlapping at 90% (`rating ± 1.645 × RD`) OR vote-cap reached. Tier 1: floor 10, cap 18. Tier 2: floor 6, cap 12. Tier 3: floor 8, cap 15.
- [x] 2.8 Replace the old fixed-list iteration in `vote()` / `endOfRound()` with a "while not stopped, pick next" loop.
- [x] 2.9 Update `renderProgress()` to show "Round N of up-to-18" instead of "N / 25".
- [x] 2.10 Add a `DYNAMIC_OPENER = false` constant; thread it through `pickNextMatchup()` so flipping it on in a later phase swaps the fixed opener for top-2-by-global-ELO.
- [ ] 2.11 Verify by manual play: starting a fresh ballot always opens Vance vs. Newsom; picking Vance always leads to Vance vs. Rubio; picking Newsom always leads to Newsom vs. AOC.
- [x] 2.12 Add a small simulation harness in `scripts/sim_engine.js` that runs 1000 random-pick ballots and reports: median votes-to-stop, distribution of total votes, coverage-floor substitution rate.

## 3. Phase C — Crowd ELO backend

- [x] 3.1 Create `migrations/0007_candidate_country_elo.sql` with the table schema from the spec (`candidate_id, country, elo, rd, sigma, n_ballots, updated_at`; primary key `(candidate_id, country)`).
- [x] 3.2 Port the Glicko-2 module from `lib/glicko2.js` into the Worker source as a shared module.
- [x] 3.3 In the `POST /api/vote` handler, after validation and abuse gate:
  - [x] 3.3.1 Select existing rows for `(picked, country)` and `(loser, country)`.
  - [x] 3.3.2 Default missing rows to `{ elo: 1500, rd: 350, sigma: 0.06, n_ballots: 0 }`.
  - [x] 3.3.3 Apply one Glicko-2 update step.
  - [x] 3.3.4 UPSERT both rows with new `elo`, `rd`, `sigma`, `n_ballots + 1`, `updated_at = now`.
- [x] 3.4 Implement `GET /api/elo`:
  - [x] 3.4.1 Parse `country`, `party`, `limit` query params; validate (`country` is ISO-2 uppercase OR `GLOBAL`; `party` ∈ `{R,D,I,all}`; `limit` ∈ `[1,50]`).
  - [x] 3.4.2 For country-specific: query `candidate_country_elo` WHERE country = ?, apply min-N filter (`n_ballots >= ELO_MIN_N`), join with candidate party from a hardcoded map in the Worker.
  - [x] 3.4.3 For Global: aggregate by `candidate_id`, weighting `elo` by `n_ballots`, summing `n_ballots`; no min-N filter.
  - [x] 3.4.4 Apply party filter, sort by `elo` DESC, slice to `limit`.
  - [x] 3.4.5 Return JSON array of `{ id, elo, rd, n_ballots, party }`.
- [x] 3.5 Add `ELO_MIN_N = 20` to `wrangler.toml` `[vars]`.
- [x] 3.6 Wire `/api/elo` into the same KV rate-limit bucket as `/api/leaderboard`.
- [x] 3.7 Add an integration test in `scripts/test_api.sh` that hits `/api/elo?country=US`, `?country=GLOBAL`, `?country=US&party=R`, and a bad-country case expecting 400.
- [ ] 3.8 Deploy to Worker preview environment; run the integration test against it.

## 4. Phase D — Stats screen (frontend)

- [x] 4.1 Add `#screen-stats` markup to `index.html` as a sibling of `#screen-start`, `#screen-vote`, `#screen-results`. Include header, back button, country chip-row, party chip-row, list container.
- [x] 4.2 Add stats screen styles to `styles.css` (filter chips, list rows, empty/error states).
- [x] 4.3 In `app.js`, add `pickStatsScope()` that:
  - [x] 4.3.1 Holds local state `{ country, party }`, defaulting to `{ country: countryHint || 'GLOBAL', party: 'all' }`.
  - [x] 4.3.2 Re-renders the screen on filter change.
  - [x] 4.3.3 Fetches `/api/elo` with the current scope; renders list rows.
  - [x] 4.3.4 Falls back to `country: 'GLOBAL'` with an explanatory note when the country has fewer than 5 candidates above min-N.
- [x] 4.4 Wire row click → existing `openDetailSheet(cid)` (no detail-sheet changes needed).
- [x] 4.5 Add empty-state and error-state renderers.
- [x] 4.6 Add back button → `show('results')` (results state must be preserved, not re-fetched).
- [ ] 4.7 Verify keyboard accessibility (filter chips reachable via Tab; row activated via Enter).

## 5. Phase E — Results refocus + share polish

- [x] 5.1 Remove `#country-leaderboard`, `#country-comparison`, `#full-ranking`, and the `#toggle-full-btn` from `#screen-results` in `index.html`.
- [x] 5.2 Remove `renderCountryLeaderboard()` and `renderCountryComparison()` calls from `showResults()`. Leave the functions in place (they may be reused inside the stats screen) but ensure they don't execute on the results path.
- [x] 5.3 Add the "See global stats →" button to the results screen; wire to `show('screen-stats')` + initial `pickStatsScope()` render.
- [x] 5.4 Add the "Post to X" button next to the existing copy + native-share buttons; URL form `https://twitter.com/intent/tweet?text=<URL-encoded share text>`.
- [x] 5.5 Update the tier-progression CTA copy to read "Keep voting · {N} more ↓" after Tier 1 and "Go deeper · {N} more ↓" after Tier 2. Hide after Tier 3.
- [ ] 5.6 Visual pass: ensure on a 390×844 viewport the top-5, emoji grid, share buttons, stats CTA, and tier CTA all fit above the fold.
- [ ] 5.7 Run mobile Lighthouse and confirm performance / accessibility / best-practices / SEO all remain ≥ 95.
- [x] 5.8 Update `specs/roadmap.md`: append a "v2 — Smart matchups + Crowd ELO" section linking back to this change.
- [x] 5.9 Update `README.md` admin recipes with a `wrangler d1 execute` example for the new `candidate_country_elo` table.
- [x] 5.10 Add a single-line entry to `specs/changelog/changelog-DD-MM-YYYY.md` summarizing the v2 ship.

## 6. Cross-cutting verification

- [ ] 6.1 End-to-end manual run: open fresh, complete Tier 1, share, open stats screen, change filters, return to ballot, complete Tier 2, complete Tier 3, share again.
- [ ] 6.2 Confirm legacy `?b=id1,id2,...` URLs still surface the friend-ballot intro on the start screen.
- [ ] 6.3 Confirm server-side `?b=<ballot_id>` URLs continue to resolve via `/api/ballot/:id`.
- [ ] 6.4 Confirm `DYNAMIC_OPENER` is `false` in the shipped build.
- [ ] 6.5 Watch the production Worker for 5xx spikes for the first 24 hours after deploy of Phase C.
