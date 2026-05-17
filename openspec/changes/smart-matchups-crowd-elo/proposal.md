## Why

The current ballot asks every visitor the same 25 random pairwise matchups in a uniform order, which wastes votes (random pairs are often low-information) and dilutes the headline product — a personal top-5 ballot — under a crowded results screen. Visitors also can't yet see *crowd* opinion at the candidate level: stats are pair-only and Borda-only, never a country-aware ELO leaderboard. This change tightens the funnel to the most-likely cohort first, picks matchups adaptively, and exposes the global ELO leaderboard so the data we collect becomes a product visitors can actually browse.

## What Changes

- **Tiered roster (15 / 12 / 13).** Headline pool shrinks from 25 to a 15-name top cohort. The remaining 10 from today's headline plus the 13 from the extended pool become two opt-in waves ("Keep voting" → "Go deeper"). Two names promote from extended to top: `trumpjr` and `pritzker`. ELO and ranking carry forward across tiers.
- **Smart matchup engine.** Round 1 is a fixed opener (Vance vs. Newsom). Round 2 is a hand-picked same-party rival to the winner (`vance → rubio`, `newsom → aoc`). From round 3 onward, matchups are adaptive: 70% close-rated pair (max information), 30% random (novelty), with a coverage floor that requires every Tier-1 candidate to appear at least once before any appears twice.
- **Glicko-2 replaces plain ELO.** Each candidate gains a rating deviation (RD). Tier-1 voting stops when the top-5 are pairwise RD-separated at 90% confidence OR an 18-vote cap is reached, whichever comes first. Plain ELO display values are still derived from the Glicko rating for backwards-compatible UI.
- **Crowd ELO backend.** New D1 table `candidate_country_elo` is incrementally updated by `POST /api/vote`. A new endpoint `GET /api/elo?country=XX&party=R|D|I|all` returns the country-filtered, party-filtered, min-N-gated leaderboard.
- **Results screen refocus.** The results screen becomes a clean ballot artifact: top-5, share-text preview, copy + X-post buttons, "See global stats →" CTA, and the "Keep voting · N more" CTA. Today's country leaderboard, you-vs-country comparison, and full-ranking toggle move off-page.
- **New stats screen.** A third top-level view (`#screen-stats`) reachable only from the results screen. Filter chips for country (visitor's + Global) and party (R / D / I / All). Sortable candidate list. Tap any row → existing detail sheet. Min-N gating (default ≥ 20 ballots per country); global view always available.
- Frozen Vance/Newsom opener for v1. A `dynamic-opener` feature flag stub is added for a later phase but kept off.
- **BREAKING (URL shape, internal-only).** The current `?b=ids&x=ids` legacy fallback now resolves only to a server-side ballot id once `/api/ballot` POST succeeds; inline-id deep links from old shares continue to work for backward compatibility but are no longer the generated format. No user-visible breaking change.

## Capabilities

### New Capabilities
- `tiered-roster`: Three-tier candidate roster (Tier 1: top 15, Tier 2: 12 opt-in, Tier 3: 13 opt-in long-tail) sharing one ELO ranking across tiers. Owns the `tier` field on candidate records and the inter-tier flow.
- `smart-matchups`: Adaptive pairwise matchup selection. Owns fixed openers, the `R2_RIVAL` map, the 70/30 adaptive-vs-random mix, the coverage floor, and the Glicko-2 stop condition.
- `crowd-elo`: Server-side per-country candidate ELO maintained from votes. Owns the `candidate_country_elo` table, incremental Glicko-2 update in `POST /api/vote`, and `GET /api/elo` filtering + min-N gating.
- `stats-screen`: Frontend candidate-ELO explorer with country + party filters. Owns the `#screen-stats` view, navigation contract from results, and row → detail-sheet wiring.
- `ballot-results-page`: Refocused results screen as a shareable ballot artifact. Owns the post-vote layout (top-5 + share buttons + stats CTA + keep-voting CTA) and what moves off-page.

### Modified Capabilities
*(No existing specs to modify — `openspec/specs/` is empty. The above are all new.)*

## Impact

- **Code (frontend):** `candidates.js` (tier field, R2_RIVAL map, roster redistribution), `app.js` (Glicko-2, `pickNextMatchup`, results-screen layout, new `#screen-stats`), `index.html` (new stats screen markup, results-screen markup pruning), `styles.css` (stats screen styles, results layout adjustments).
- **Code (backend):** `migrations/` (new `candidate_country_elo` migration), `api/` Worker (incremental Glicko-2 update on `/api/vote`, new `/api/elo` endpoint).
- **Specs / docs:** `specs/roadmap.md` gets a new "v2 — Smart matchups + Crowd ELO" section. `README.md` admin recipes section gains an ELO query example.
- **Data:** New D1 table only; no backfill required. Optional: rebuild `candidate_country_elo` from `pair_aggregates` history at deploy time to seed nonzero starting values.
- **Dependencies:** None added. Glicko-2 is implemented in ~80 LOC of plain JS.
- **Risk:** Glicko-2 stop condition can terminate before Tier 1 feels "full" if a user picks lopsidedly. Mitigation: the 18-vote cap and a 10-vote minimum floor bracket the convergence.
- **No user-visible URL breakage.** Inline `?b=ids&x=ids` legacy links still resolve.
