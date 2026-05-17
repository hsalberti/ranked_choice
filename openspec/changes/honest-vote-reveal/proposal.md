# Honest Vote Reveal

## Why

The vote-flow stat overlay is showing fabricated data. `fetchPairStats()` in `app.js:363` returns a deterministic seed derived from `hashStr(pairKey)` — a plausible-looking 35-65% split with a 200-1200 "vote count" pulled from the same hash. Real backend data from `GET /api/stats` only swaps in when (a) the vote is Tier 1, *and* (b) local-country pair votes ≥ 5. In every other case — every Tier 2/3 vote, every Tier 1 vote in low-traffic countries — the user is reading numbers we made up. The roadmap acknowledges this gap (`specs/roadmap.md`: "Stats overlay is seeded by a deterministic hash — not real data") but it has not been retired.

Separately, the existing overlay never surfaces ELO or rank for the candidate the user just picked. The crowd-ELO system (introduced in `smart-matchups-crowd-elo`) does the work server-side but the data never appears in the moment of the vote — only in the standalone stats screen, after the ballot is done. The vote reveal is the highest-engagement moment in the funnel; it's the right place to make the rating product visible.

This change retires the seeded fake, replaces the floating overlay with an in-card reveal that tints the winning candidate's card in their party color, and renders real ELO, rank, and pair-win statistics from a single extended `/api/stats` call. Subtle sound design (a pick click + a resolved chime) gives the moment weight.

## What Changes

- **Retire the seeded fake.** Delete `fetchPairStats()`, `loadLocalVotes()`, `saveLocalVote()`, `undoLocalVote()`, and the `STORAGE_LOCAL_VOTES` localStorage key. No replacement, no graceful-degradation hash fallback — if the API is unreachable, show no statistics rather than fabricated ones.
- **Replace the floating overlay with in-card reveal.** Delete `#stat-overlay` markup, `showStatOverlay()`, `overlayTimer`, and the tap-overlay-to-advance handler. On vote, the winning card's chrome (background, border, info panel) tints to party color — `party-D` blue or `party-R` red — while the portrait stays full-color. The losing card dims to ~50% opacity, no tint. The winner card's existing layout slot gets two new lines:
  - `2034 ELO · Rank #4` (or `· UNRANKED` if `n_ballots < 10`)
  - `Won against Newsom 29% of 4,329 votes` (or `Early matchup — N votes so far` if `pair_total < 10`)
  Reveal duration is 1.5s with tap-anywhere-to-advance.
- **Extend `GET /api/stats`** to return per-candidate ELO and global rank for both `a` and `b`. Rank is computed inline as the count of candidates with strictly higher ELO and `n_ballots >= 10`. Below-floor candidates return `rank: null`. The response also gains a `scope` field (`"GLOBAL"` or an ISO-2 country code) indicating which dataset drove the pair counts.
- **Country activation threshold.** `/api/stats` returns country-specific pair counts only if the visitor's country has ≥ 10,000 total votes across all pairs; otherwise it falls back to GLOBAL counts. This replaces the existing per-pair `≥ 5` heuristic with a much stricter, country-wide gate.
- **10-vote leaderboard floor.** `GET /api/elo` GLOBAL view enforces `n_ballots >= 10` (currently `> 0`). Below-floor candidates are excluded from leaderboard responses and rank computations.
- **Tier 2/3 votes hit the backend.** Drop the `if (activeTier === 1)` gate in `postRemoteVote()`. All tier votes flow to `POST /api/vote` and contribute to candidate ELO. T2/T3 candidates still need 10 votes before they appear in leaderboards or get ranked.
- **Sound design.** Add `lib/sounds.js` with two WebAudio-synthesized cues: a soft pick click on card tap, a low-volume resolved chime when the reveal completes. Mute toggle in the start-screen header, persisted to localStorage, default ON.

## Capabilities

### New Capabilities
- `vote-reveal`: In-card vote reveal replacing the floating stat overlay. Owns party-color card tint rules, loser-card dimming, the 2-line reveal panel, advance timing, and the WebAudio sound layer with its mute toggle.

### Modified Capabilities
- `crowd-elo`: Extends `GET /api/stats` response with `elo`, `rank`, and `scope` fields; introduces the 10-vote leaderboard floor on `GET /api/elo` GLOBAL; documents that tier is not a gate on `POST /api/vote` (T2/T3 votes accepted).

## Impact

- **Code (frontend):** `app.js` (large delete + in-card render path), `index.html` (remove `#stat-overlay` markup, add mute toggle), `styles.css` (party-tint chrome rules, loser-dim, reveal panel layout), `lib/sounds.js` (new file, WebAudio synth).
- **Code (backend):** `api/src/handlers.ts` (extend `handleStats` response, add country-threshold helper, enforce floor on `handleElo`).
- **Specs / docs:** `specs/roadmap.md` gains a "v2.1 — Honest reveal" section that retires the seeded-fake gap from Phase 0. `README.md` admin recipes section gains the country-threshold caveat for `/api/stats`.
- **Data:** No schema changes. No migrations.
- **Risk:** With the floor at 10 votes, fresh deploys will show `UNRANKED` for nearly every candidate until aggregate vote volume catches up. Acceptable — the floor exists precisely so we don't surface rank for noise. The country activation threshold (10k) means country-specific data effectively never activates at v1 launch volumes; this is the intended conservative default.
- **No user-visible URL breakage.** No API contract removed — `/api/stats` gains fields, `/api/elo` gains a stricter filter that omits noisy rows.
