## Context

The site is a single-page Cloudflare Pages frontend (`/web` → `index.html` + `app.js` + `candidates.js`) backed by a Cloudflare Worker (`/api`) using D1 for persistence and KV for rate-limiting. Phases 0–6 are functionally complete (per `specs/roadmap.md`); pair-level vote aggregation, country-aware leaderboards, Borda scoring, abuse-gating with Turnstile + KV, and an OG image endpoint are all live or in deploy.

Today's voting flow has three properties this change overturns:

1. **Uniform random matchups.** `buildMatchups()` in `app.js:244` produces a fixed list of 25 matchups where each candidate appears exactly twice. Vote order is essentially random within each round. This wastes votes — random pairs are often low-information after the first few rounds.
2. **Plain ELO with K=36.** No rating deviation, so there is no principled "we know enough — stop" signal. The session always runs the full 25 matchups.
3. **Cluttered results screen.** The post-vote view stacks top-5, full ranking toggle, "Keep ranking" CTA, extended ranking, country leaderboard, and you-vs-country comparison on one screen. The shareable artifact (the user's ballot) competes for attention with crowd data.

Constraints carried in from existing phases:

- No third-party trackers; cookieless first-party only.
- Free Cloudflare tier; no new paid dependencies.
- Anonymous-by-default — no accounts.
- Roster frozen at v1 (per `specs/roadmap.md` cross-cutting principles) — so this change rebalances the *tier* of existing candidates rather than introducing new names. Two promotions from extended → top (`trumpjr`, `pritzker`) reflect NYT prominence and are themselves a small, deliberate roster amendment justified in the proposal.

## Goals / Non-Goals

**Goals:**
- Reduce average vote count to a confident top-5 from 25 → ~12–15 for the median user, while preserving an option to "keep voting" for engaged users.
- Make the opener feel curated and high-engagement (Vance vs. Newsom; then a same-party rival) without sacrificing replay variety later.
- Surface country-aware crowd ELO as a first-class explore surface, replacing the inline-stats clutter on the results screen.
- Land all changes as additive layers — no breaking changes to existing API contracts; share URLs and friend-ballot deep links continue to resolve.

**Non-Goals:**
- Dynamic openers (deferred behind a feature flag; off in v1).
- Sign-in / cross-device persistence (still Phase 7+).
- Multi-language UI; copy stays English-only.
- A separate "ELO history" or time-windowed view; scope is current-state only.
- Server-side enforcement of the tier system. Tiers are a frontend curation concern; the backend stores votes and computes ELO per candidate without any tier awareness.

## Decisions

### 1. Glicko-2 over plain ELO

**Decision:** Implement Glicko-2 (τ=0.5, RD₀=350, σ₀=0.06, rating₀=1500) in ~80 LOC of plain JS, both client-side (per-user ratings) and server-side (per-country aggregate ratings).

**Why:** The stop condition "the top-5 are confidently separated" requires a rating *with uncertainty*. Plain ELO can't express that. Glicko-2's RD halves naturally with informative matchups, which means the stop condition tightens automatically when the user is decisive and stays loose when they're conflicted. Same algorithm on both client and server keeps the mental model singular.

**Alternatives considered:**
- *Plain ELO with a fixed vote cap* — simplest, but no "feels-done" signal; equally wasteful for users who decide quickly.
- *TrueSkill* — Bayesian rating with similar properties to Glicko-2, but the canonical implementation expects team rosters and the available JS ports are heavier. Glicko-2 is the standard one-on-one variant.
- *Bradley-Terry MLE* — best ranking quality but requires solving a system after every vote; not real-time-friendly.

### 2. Hand-picked R2 rival map, two entries only

**Decision:** Define a constant `R2_RIVAL` in `candidates.js` with exactly two entries: `vance: 'rubio'`, `newsom: 'aoc'`. R3+ uses adaptive selection only. No rivals for any other R1 winner (impossible under a frozen Vance/Newsom opener anyway).

**Why:** Two engagement-hand-picked rounds give the user a "the algorithm is showing me what I came for" feeling. After that, adaptive selection takes over for both information value and surprise. Keeping the rival map minimal (two entries) prevents it from becoming an editorial maintenance burden — and matches the user's stated preference ("the rest is just random").

**Alternatives considered:**
- *Full rival map for every Tier-1 candidate* — editorial burden + rigidity. Rejected.
- *Closest-rated same-party automatic rival* — degenerates on day 1 (all ratings start at 1500, so pick is alphabetical). Rejected.

### 3. Adaptive selector mix: 70% close-rated, 30% random

**Decision:** From R3 onward, each next matchup is selected with 70% probability from "close-rated pair candidates" (the lowest |Δrating| among allowed pairs) and 30% probability uniformly at random from allowed pairs. "Allowed" = both in the active tier, respect the coverage floor.

**Why:** Pure adaptive selection feels eerily targeted; pure random wastes votes. The 70/30 split is the lightest-weight hybrid that preserves both. Tunable post-launch.

**Alternatives considered:**
- *Information-gain bandit (Thompson sampling)* — theoretically optimal but adds complexity for marginal gain at our vote counts (10–18 per tier).
- *Epsilon-greedy with annealing* — pleasant intellectually, but adds a tuning knob (the decay schedule) we don't need.

### 4. Coverage floor: every candidate appears once before any appears twice

**Decision:** Track `appearances[id]` per tier; the selector rejects any pair that would push a candidate to 2+ appearances while some active-tier candidate is still at 0. If both selectors (close-rated and random) produce a rejected pair, substitute the higher-appearance candidate in the pair with an unseen one (preferring same party for engagement continuity).

**Why:** Eliminates the "I never even saw her — why is she #11?" UX trap. The cost is small: with 15 candidates and ~14 matchups, full coverage is comfortably achievable.

### 5. Tier-1 stop condition with floor and cap

**Decision:** Tier 1 ends when (a) top-5 by rating have pairwise non-overlapping 90% CIs (`rating ± 1.645 × RD`), with a minimum vote floor of 10 before this condition is checked; OR (b) the user reaches 18 votes — whichever fires first. Tier 2 and Tier 3 mirror this with smaller bounds (Tier 2: floor 6, cap 12; Tier 3: floor 8, cap 15).

**Why:** The floor prevents premature termination from a streaky early run (e.g., the user picks Vance 5 times — momentarily Vance's CI separates from rank-2 but it's noise). The cap bounds session length so we never trap a user in an unconvinced state. The 90% CI threshold is a standard Glicko convention.

**Alternatives considered:**
- *Bayes factor threshold* — formally cleaner but harder to explain.
- *No cap, fixed floor only* — risks long sessions when ratings are clustered.

### 6. Crowd ELO storage: separate D1 table, incremental on vote

**Decision:** New D1 table `candidate_country_elo (candidate_id, country, elo, rd, sigma, n_ballots, updated_at)`, primary key `(candidate_id, country)`. Update both candidates' rows on each successful `POST /api/vote`. No backfill from `pair_aggregates` history at deploy time (optional follow-up).

**Why:** Querying `pair_aggregates` and computing ELO on-read would mean recomputing across thousands of rows per stats-screen open. A dedicated table costs ~40 candidates × ~50 countries = ~2000 rows of write fan-out, trivial for D1. Incremental Glicko-2 is what the algorithm is designed for — no batch needed.

**Alternatives considered:**
- *Compute-on-read from `pair_aggregates`* — slower with each new vote; cold cache.
- *Periodic batch (cron)* — stale stats; adds a worker schedule we don't otherwise need.

### 7. Min-N gating server-side, threshold via env var

**Decision:** `GET /api/elo` filters out rows with `n_ballots < ELO_MIN_N` for country-specific requests (default 20). Global view has no gating. The threshold is a Worker env var so it can be tuned without code changes.

**Why:** Country views in low-traffic markets are noise without min-N. Putting the gate server-side ensures consistency across UI surfaces and prevents accidental "raw ELO" leaks. Env-var override matches existing Worker config conventions.

### 8. Stats screen as a third top-level screen, not a modal

**Decision:** Implement `#screen-stats` as a sibling to `#screen-start`, `#screen-vote`, `#screen-results`, following the existing `show(name)` pattern in `app.js:310`. Reach it only from the results screen. Provide a back affordance that returns to `#screen-results` without re-rendering it (state preserved).

**Why:** A modal would constrain content height and complicate filter-chip layout. A full screen matches the existing pattern and lets us reuse the avatar/party-chip/detail-sheet plumbing without redesign. Single entry point keeps stats from leaking the "crowd answer" into the vote funnel.

### 9. Share URL: prefer server-side ballot id, legacy inline fallback

**Decision:** No change to existing URL handling. `shareUrl()` already prefers `?b=<id>` when `submitBallot()` succeeds and falls back to `?b=ids&x=ids` otherwise. Both forms continue to be parsed for friend-ballot intros.

**Why:** Already-shipped behavior is correct. Listing it here for clarity since this change touches `renderShare()` for the new layout.

### 10. X-post button, not native share

**Decision:** Add an explicit "Post to X" button (alongside the existing copy button and `navigator.share` button when available) that opens `https://twitter.com/intent/tweet?text=<encoded>` in a new tab.

**Why:** The user specifically asked for an X-post path. `navigator.share` isn't available on desktop browsers, where most copy/share happens; an explicit button bypasses that. The native `navigator.share` button stays for mobile, where it's preferred.

## Risks / Trade-offs

- **Glicko-2 numerical drift on server** → Server-side updates are float64 with a single read-modify-write per vote; precision is fine for our scale (no compounding ladder games). Mitigation: keep `elo` and `rd` as REAL in D1, not normalized integers.
- **Stop condition fires too early on lopsided picks** → A user who picks Vance 8 times in a row might separate Vance's rating from the field quickly. Mitigation: 10-vote floor prevents this from ending Tier 1 in fewer than 10 votes. Tier-1 lower-bound is still high enough that all 15 candidates likely appear at least once.
- **Min-N hides candidates in low-traffic countries** → Brazilian or US visitors see rich data; Latvian visitors see thin data. Mitigation: fallback to Global with an explanatory note ("Not enough data in <country> yet — showing Global"). Communicate the n_ballots count per row so users understand the basis.
- **Promoting `trumpjr` and `pritzker` to Tier 1** → mild break with the "roster frozen at v1" principle. Mitigation: documented in proposal as a deliberate small amendment, not a roster expansion. No new names enter the system.
- **Adaptive selector + coverage floor interaction** → In adversarial sequences, the "substitute higher-appearance candidate with an unseen one" rule could produce a non-close pair (defeats the 70% adaptive intent). Mitigation: log a counter; if substitutions exceed 20% of post-R2 matchups in real traffic, revisit.
- **Frontend Glicko-2 implementation bugs** → Glicko-2 has a known-tricky volatility (σ) update. Mitigation: vendor the reference test vectors from the Glickman paper into a unit test (`/scripts/test_glicko.js`) before wiring into `app.js`.
- **Vote endpoint write fan-out** → Each `/api/vote` now writes to two `candidate_country_elo` rows in addition to one `pair_aggregates` row. D1 free-tier write budget remains comfortable, but watch the Logpush for write-failure spikes after deploy.
- **Existing pair_aggregates becomes redundant** → Not removing it. `/api/stats?a=X&b=Y` still serves the per-pair overlay on the vote screen; that's a different surface from the candidate-level ELO leaderboard. Both serve their purpose.

## Migration Plan

This change ships in 5 deployable phases, each independently revertible:

1. **Phase A — Roster split (frontend only).**
   - Add `tier` field to all 40 candidates in `candidates.js`.
   - Move `trumpjr` and `pritzker` from `EXTENDED_CANDIDATES` to the headline pool, marked `tier: 1`.
   - Mark the remaining 12 originally-headline as `tier: 2`, all 13 remaining extended as `tier: 3`.
   - Update `buildMatchups()` to accept a tier filter.
   - Update tier-CTA copy on the results screen.
   - **Revert:** drop the `tier` field; restore `EXTENDED_CANDIDATES`.

2. **Phase B — Smart matchup engine (frontend only).**
   - Land Glicko-2 implementation + Glickman test vectors.
   - Replace `applyElo()` with Glicko-2 update; keep `ratings[id]` as the rating field for backward-compat display.
   - Add `R2_RIVAL` constant.
   - Implement `pickNextMatchup()` with the fixed R1 → R2 → adaptive flow.
   - Implement coverage floor and stop condition.
   - **Revert:** restore `applyElo()` and `buildMatchups()` flow.

3. **Phase C — Crowd ELO backend.**
   - New migration `0007_candidate_country_elo.sql`.
   - Update `POST /api/vote` handler with incremental Glicko-2 update (server-side port of the same module).
   - New `GET /api/elo` endpoint.
   - `ELO_MIN_N` env var in `wrangler.toml`.
   - **Revert:** remove the endpoint and route; the migration is forward-only but the table can be ignored.

4. **Phase D — Stats screen (frontend).**
   - New `#screen-stats` markup in `index.html`.
   - Stats screen styles.
   - `pickStatsScope()` function and filter-chip wiring.
   - "See global stats →" CTA on results screen.
   - **Revert:** hide the CTA on results; the stats screen markup remains dormant.

5. **Phase E — Results refocus + polish.**
   - Remove inline country leaderboard, you-vs-country comparison, full-ranking toggle from results screen markup.
   - X-post button + share-button layout pass.
   - Update `specs/roadmap.md` and README admin recipes.
   - Lighthouse re-check on mobile.
   - **Revert:** restore prior `#screen-results` markup.

**Rollback strategy:** Each phase is a separate PR. Phase A through E can be reverted independently except that E depends on D being shipped. If Phase C breaks production, revert the Worker deploy — the frontend silently falls back to "stats screen empty state" without crashing.

## Open Questions

- **Backfill `candidate_country_elo` from `pair_aggregates`?** Optional. The table can start empty and warm up over a week of real traffic. Backfill would be a one-off Worker script. Defer unless we want immediate populated stats for the launch demo.
- **Min-N value (20 default).** Tunable; revisit after a week of post-launch data to see what fraction of country views land on "empty" vs. "populated."
- **Adaptive selector tuning (70/30 split).** Reasonable starting point; A/B test post-launch by varying the close-rated fraction between 0.5 and 0.85.
- **Dynamic-opener flag default after v1.** When (if ever) do we flip `DYNAMIC_OPENER = true`? Likely once `candidate_country_elo` has > 1000 ballots per major country and the leaderboard is stable across 7-day windows. Track as a Phase 7 follow-up.
