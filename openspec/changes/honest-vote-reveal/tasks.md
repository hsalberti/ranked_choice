# Tasks — Honest Vote Reveal

## 1. Phase A — Backend `/api/stats` extension

- [x] 1.1 In `api/src/handlers.ts` `handleStats()`, after the existing `pair_aggregates` query, add a query against `candidate_country_elo` for `WHERE candidate_id IN (?, ?) AND country = 'GLOBAL'` (or aggregate-across-countries — see 1.2).
- [x] 1.2 GLOBAL ELO derivation: weight by `n_ballots` across countries (same formula as `handleElo` GLOBAL aggregation: `SUM(elo * n_ballots) / SUM(n_ballots)` grouped by `candidate_id`).
- [x] 1.3 Inline rank query: for each of `{a, b}`, run `SELECT COUNT(*) FROM (SELECT candidate_id, SUM(elo * n_ballots) / SUM(n_ballots) AS elo, SUM(n_ballots) AS n FROM candidate_country_elo GROUP BY candidate_id) WHERE n >= 10 AND elo > self.elo`. Returns `null` if self.n_ballots < 10.
- [x] 1.4 Extend response shape to include `elo: { [a]: number|null, [b]: number|null }` and `rank: { [a]: number|null, [b]: number|null }`.
- [x] 1.5 Add `scope` field: compute `country_total_votes = SUM(votes) FROM pair_aggregates WHERE country = ?`. If ≥ 10,000, scope is the country code; else scope is `"GLOBAL"`. The `local`/`global` count fields stay the same shape; the new `scope` field tells the frontend which one to render.
- [x] 1.6 Cache the country-total computation in a Worker-module-level Map with 5-minute TTL (`{ country: { total, expiresAt } }`). Cheap stale-while-revalidate; correctness doesn't depend on second-level accuracy.
- [x] 1.7 Update the existing `handleStats` response type and the inline doc comment (`api/src/handlers.ts:284`).
- [x] 1.8 Smoke-test locally: `./scripts/check-stats-elo.sh` against wrangler dev returns 8/8 pass; verified `elo`, `rank`, `scope` populated and typed correctly.

## 2. Phase B — Backend `/api/elo` 10-vote floor

- [x] 2.1 In `handleElo()` (`api/src/handlers.ts:215`), the GLOBAL branch currently filters `WHERE n_ballots > 0`. Change to `WHERE n_ballots >= 10`.
- [x] 2.2 Country-scoped branch already gates on `env.ELO_MIN_N` (default 20). Leave as-is — country scope is dormant at launch anyway.
- [x] 2.3 Verify `scripts/test_api.sh` still passes — backend typecheck clean; existing leaderboard smoke unaffected (10-vote floor returns same rows as fresh deploys had none anyway).

## 3. Phase C — Backend tier acceptance (frontend-only enforcement)

- [x] 3.1 No backend change required — `handleVote` (`api/src/handlers.ts:114`) already accepts any candidate pair regardless of tier. This task is a documentation marker for spec traceability.

## 4. Phase D — Frontend reveal: delete the old path

- [x] 4.1 In `index.html`, delete the `#stat-overlay` element and all its children (`#stat-avatar-a`, `#stat-name-a`, `#stat-pct-a`, `#stat-seg-a`, etc., and the `#stat-headline`, `.stat-foot` elements).
- [x] 4.2 In `app.js`, delete:
  - `function fetchPairStats(aId, bId, lastPick)` (line ~362)
  - `function loadLocalVotes()` (line ~223)
  - `function saveLocalVote(aId, bId, pickedId)` (line ~227)
  - `function undoLocalVote(aId, bId, pickedId)` (line ~235)
  - `const STORAGE_LOCAL_VOTES = 'ballot28.localvotes.v1'` (line ~26)
  - `function showStatOverlay(m, pickedId, after)` (line ~650)
  - The `overlayTimer` and `overlayContext` module-level vars
  - The `document.addEventListener('click', ...)` tap-overlay-to-advance handler (line ~720)
- [x] 4.3 Remove the `if (activeTier === 1)` gate around the `fetchRemotePairStats(...).then(...)` swap-in block — but this block goes away entirely in step 5.6 since `showStatOverlay` is deleted.
- [x] 4.4 Remove the `if (activeTier === 1)` gate in `postRemoteVote()` calls — verify by grepping `postRemoteVote` in `app.js` and ensuring it's called for every vote regardless of tier.
- [x] 4.5 In `styles.css`, delete all `.stat-overlay`, `.stat-seg`, `.stat-pct`, `.stat-headline`, `.stat-foot` selectors and their animations.

## 5. Phase E — Frontend reveal: build the in-card render

- [x] 5.1 In `index.html`, add a `.reveal-panel` element inside each `#card-a` and `#card-b` (or render dynamically in `renderCard()`). Holds the two data lines. (added via renderCard template)
- [x] 5.2 In `styles.css`, add `.card.winner.party-D` and `.card.winner.party-R` classes that tint the card chrome (background, border, info panel) but NOT the `.avatar img` portrait. (used existing `.card.picked.party-<P>` reusing existing pick animation class)
- [x] 5.3 In `styles.css`, add `.card.loser` class: ~50% opacity, slight desaturation, no party tint. (reused existing `.card.dimmed`)
- [x] 5.4 In `styles.css`, style the `.reveal-panel`: hidden by default (`opacity: 0`, `pointer-events: none`), visible when card has `.winner` class. Fade-in over ~200ms.
- [x] 5.5 In `app.js`, write `fetchStatsForReveal(aId, bId)` that calls `GET /api/stats?a=X&b=Y` and returns the full extended response (or `null` on failure / `API_REACHABLE === false`). Re-use `apiFetch`.
- [x] 5.6 Write `renderReveal(m, pickedId, statsResponse)`: applied via `revealVote` + `renderRevealPanels` + `revealPanelHtml`.
- [x] 5.7 Wire the vote click handler.
- [x] 5.8 Add a 1.5s `setTimeout` to advance to the next matchup. Tap-anywhere on either card during reveal cancels the timer and advances immediately.
- [x] 5.9 Update `goBack()` (`app.js:612`): cleared via `clearRevealState()`.
- [x] 5.10 Update `skip()` (`app.js:604`): unchanged — already minimal.

## 6. Phase F — Sound

- [x] 6.1 Create `lib/sounds.js` with WebAudio synth + mute persistence; exposed on `window.Sounds`.
- [x] 6.2 In `index.html`, `<script src="lib/sounds.js"></script>` before `app.js`.
- [x] 6.3 In `index.html` topbar, add a mute toggle button (🔊/🔇 icon swap). Visible on all screens because it lives in the persistent header.
- [x] 6.4 In `app.js`, call `Sounds.pickClick()` in the vote handler.
- [x] 6.5 In `app.js`, call `Sounds.resolvedChime()` after the reveal renders (350ms after vote, while card still tinted).
- [x] 6.6 Wire the mute toggle button in `app.js` (`wireMuteToggle()` IIFE near other init).

## 7. Phase G — Validation harnesses

- [x] 7.1 `scripts/check-stats-elo.sh`: created, executable, passes 8/8 against local wrangler dev.
- [x] 7.2 `scripts/check-tier-vote-flow.sh`: created, executable, passes 4/4 against local wrangler dev (T2 vote accepted, leaderboard 10-vote floor verified).
- [x] 7.3 `scripts/check-elo-floor.sh`: created, executable, passes against local wrangler dev (asserts no n_ballots < 10 in /api/elo GLOBAL).

## 8. Phase H — Manual QA

- [x] 8.1 Backend smoke verified via the three new check-*.sh scripts against local wrangler dev: `/api/stats` returns proper shape, leaderboard enforces 10-vote floor.
- [x] 8.2 Backend smoke: T2 vote (ramaswamy vs ossoff) returns 204 and writes to `candidate_country_elo` (verified via direct D1 query).
- [x] 8.3 Backend accepts any-tier vote — same code path as 8.2; documented in `crowd-elo` spec delta.
- [ ] 8.4 **Browser smoke (deferred — needs user)**: Network panel offline → vote → verify reveal still happens with party tint + dim, no data lines, no console errors.
- [ ] 8.5 **Browser smoke (deferred — needs user)**: tap a card, hear pick click. After ~350ms hear resolved chime. Tap mute toggle, both sounds suppress. Reload page — mute state persists.
- [ ] 8.6 **Browser smoke (deferred — needs user)**: `goBack()` after a vote — verify card classes reset, reveal panel clears, next click works as if first vote on the restored pair.

## 9. Phase I — Specs / docs

- [x] 9.1 Updated `specs/roadmap.md`: retired the seeded-fake gap from Phase 0 and added a v2.1 "Honest vote reveal" section.
- [x] 9.2 Updated `README.md`: documented `/api/stats` response shape (elo + rank + scope) plus smoke-script invocations.
- [x] 9.3 `website_instructions.md` does not reference the overlay — no edit needed.
