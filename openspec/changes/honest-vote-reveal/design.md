# Design — Honest Vote Reveal

## Context

The vote-reveal flow today is the highest-engagement moment in the product — a user has just made a choice, and we have ~1.5 seconds of their full attention before the next pair lands. We currently spend that moment on a floating overlay that shows fabricated percentages and never displays the candidate's actual rating. The change retires the fake, kills the overlay, and puts the real data on the card itself.

The data plumbing for this already exists. `POST /api/vote` runs Glicko-2 against `candidate_country_elo` on every vote. `GET /api/elo` exposes the leaderboard. `GET /api/stats` exposes per-pair vote counts. What's missing is (a) ELO + rank in the same response as pair counts so the reveal is one round-trip, (b) a frontend that actually displays it, and (c) a principled gate that hides numbers when we don't have enough data to be honest.

Constraints carried in from prior phases:

- Free Cloudflare tier. No new dependencies. WebAudio for sound is browser-native (zero asset cost).
- Anonymous-by-default, cookieless first-party only. Mute toggle uses localStorage (already established pattern).
- Roster frozen at v1; this change is rendering-only on the frontend and a small response-shape change on the backend.
- The seeded-fake `fetchPairStats()` is also currently the offline fallback. The change deletes it outright — when the API fails, we show no statistics, not fabricated ones.

## Goals / Non-Goals

**Goals:**
- Display only real data, never seeded fakes.
- Make the candidate's ELO and rank visible at the moment of the vote.
- Tighten the visual ritual: party-color tint on the winning card communicates the choice immediately, before any number renders.
- Keep round-trips minimal: one `/api/stats` call per vote, returning everything the reveal needs.

**Non-Goals:**
- No ELO history, no time-windowed views.
- No animated ELO count-up (user explicitly opted for plain final number).
- No bar-fill or pair-win sound effects (user opted for pick click + resolved chime only).
- No on-card rank for country scope below the 10k activation threshold — country rank is deferred until launch volume justifies it.
- No backwards-compatibility shim for the seeded fake. Removal is total.

## Decisions

### 1. Single round-trip via extended `/api/stats`

**Decision:** Extend `GET /api/stats?a=X&b=Y` to return `elo: {[id]: number}`, `rank: {[id]: number|null}`, and `scope: "GLOBAL"|"<ISO2>"` alongside the existing `local`, `global`, and `total` fields. No new endpoint.

**Why:** The reveal needs five pieces of information: winner ELO, winner rank, loser ELO, loser rank, pair counts. The cheapest path is one extended response. Adding a `/api/rank` endpoint would force the frontend to fan out to two calls and race them against the 1.5s reveal window; that's the kind of fragility we don't need. Rank is computed inline against the existing `candidate_country_elo` table — `COUNT(*) WHERE elo > self.elo AND n_ballots >= 10` is a single indexed scan.

**Alternative considered:** Frontend pulls the leaderboard once on session start, caches it, and derives rank locally. Rejected because the leaderboard updates with every vote in the session — caching it would mean stale ranks after a few votes, exactly the moment when the user is most attentive to whether their pick moved the needle.

### 2. 10-vote floor for ranks and leaderboards

**Decision:** Both `GET /api/elo` GLOBAL and the inline rank computation in `/api/stats` enforce `n_ballots >= 10`. Candidates below the floor are excluded from rank-counting and are reported as `rank: null` (which the frontend prints as `UNRANKED`).

**Why:** With Glicko-2's default RD of 350, a candidate with 1-2 votes has an enormous confidence interval — their displayed rank is meaningless and would jitter wildly between votes. Ten votes is the lowest threshold at which the rating has converged enough to give a stable rank within ±2 positions. Below that, "UNRANKED" is the honest answer.

**Alternative considered:** Use Glicko-2's RD directly as the gate (e.g., `rd < 200`). Rejected because it's an internal signal — visitors can't reason about it. A vote count is intuitive.

### 3. Country activation threshold at 10,000

**Decision:** `/api/stats` chooses country-vs-global scope based on whether the visitor's country has `SUM(votes) >= 10000` across all pairs. The chosen scope is reported in the response as `scope: "GLOBAL"` or `scope: "US"` (etc.) — frontend renders the appropriate copy ("of 4,329 votes" vs. "of 4,329 votes in US").

**Why:** Pair-level statistics are noisy at low volumes. The previous heuristic (per-pair ≥ 5) flipped to "real data" too early — a single user voting in a small country could trigger the swap mid-overlay. A country-wide gate at 10k means the country view only activates when there's genuine signal. At v1 launch volumes this threshold means everyone sees GLOBAL data; that's intentional. As volume grows, large countries will naturally cross over.

**Implementation note:** Computing `SUM(votes)` over `pair_aggregates` on every `/api/stats` request would be wasteful. Cache the country totals in-memory on the Worker for ~5 minutes (Worker isolates make a stale-while-revalidate pattern cheap). The threshold doesn't need second-level precision.

**Alternative considered:** Use unique IPs / unique sessions instead of raw vote count. Rejected because it requires new tracking infrastructure we don't have, and raw vote count is a fine proxy for country activity.

### 4. Tier 2/3 votes hit the backend

**Decision:** Remove the `if (activeTier === 1)` gate in `postRemoteVote()`. All votes from all tiers flow to `POST /api/vote` and contribute to global ELO and pair aggregates.

**Why:** The original "Tier 1 only" gate was set in `smart-matchups-crowd-elo` on the theory that T2/T3 are "personal refinement" and shouldn't pollute the global ranking. In practice, this means T2/T3 candidates have no crowd data at all — a visitor voting in T2 sees no real numbers, and the seeded fake is the only thing the frontend can render. With the 10-vote floor in place, sending T2/T3 votes to the backend is safe: low-traffic candidates simply remain `UNRANKED` until they cross the floor, and high-traffic candidates get the rating they deserve.

This effectively retires the T1/T2/T3 distinction at the backend layer. The frontend still uses tiers for matchup pool selection (Tier 1 first, then opt-in T2, then opt-in T3) but the backend just sees pair votes.

### 5. Sound: WebAudio synthesis, two cues only

**Decision:** New file `lib/sounds.js` exports `pickClick()` and `resolvedChime()`, both ~10 LOC of WebAudio oscillator + gain envelope. No asset files. Mute toggle button in the start-screen header (and persists to vote-screen header), state in `localStorage.getItem('ballot28.muted.v1')`, default unmuted.

**Why:** Two cues balance feedback density (so the user feels the choice) against fatigue (so the cues don't grate over a 15+ vote session). Synthesizing them means zero asset payload, no licensing concerns, and reliable behavior across browsers without preloading. Mute defaults to ON because most visitors arrive in scrolling-with-sound-off mobile contexts; if they want it, they enable it.

**Pick click:** 30ms triangle wave at ~800 Hz, exponential gain decay. Crisp, no resonance.
**Resolved chime:** Two-note arpeggio (E5 → A5, ~120ms each) on a sine wave with a soft gain envelope. Audible but never percussive.

**Alternative considered:** Tiny WAV samples. Rejected — synthesis is ~30 LOC, no network cost, and the audio quality is fully sufficient for two short cues. We can swap to samples later if we want richer textures.

### 6. Floating overlay deleted, not deprecated

**Decision:** The `#stat-overlay` element and all related code (`showStatOverlay`, `overlayTimer`, `overlayContext`, `loadLocalVotes`, `saveLocalVote`, `undoLocalVote`, `STORAGE_LOCAL_VOTES`, `fetchPairStats`, the tap-overlay-to-advance handler) is deleted in this change. No feature flag, no transition period.

**Why:** Keeping both paths means maintaining two reveal mechanisms and reasoning about which one fires when. The redesign supersedes the overlay entirely; there's no scenario where we'd want to re-enable it. Clean deletion is cheaper than a flag.

**`goBack()` impact:** The current back button restores the prior matchup. It currently clears the overlay via `clearTimeout(overlayTimer)`. In the new flow, `goBack()` must instead reset the winner card's tint class, restore the loser card's opacity, hide the reveal panel, and clear any pending advance timer. The `voteHistory` stack is unchanged.

### 7. Empty-state on API failure

**Decision:** If `/api/stats` fails or `API_REACHABLE === false`, the reveal still happens (party tint + loser dim + 1.5s timer + sound), but the two data lines are not rendered. The card layout reserves space for them so there's no layout shift.

**Why:** The vote itself still records locally (the existing `applyElo()` and `wins[]` machinery is independent of the network). Showing the visual reveal preserves the engagement feel; suppressing the data lines is honest about what we don't have. Fabricating numbers because the API is down is exactly the antipattern this change exists to eliminate.

## Risks / Trade-offs

- **Cold start looks empty.** At v1 launch volume, most pairs will have `pair_total < 10` and most candidates will be `UNRANKED`. The reveal will show the party tint + "Early matchup — 0 votes so far" for early visitors. Mitigation: the cold-start window is brief once the site has any real traffic, and "early matchup" copy is honest framing rather than apologetic. Pre-seeding via curl-loop is an option if we want to skip the cold start (off-by-default, owner discretion).
- **Country threshold dormancy.** The 10k country threshold means country scope effectively never activates at launch. This is intentional but worth flagging — if the product later wants country narratives at lower volumes, the threshold is the lever.
- **Rank can be stale within a session.** The user's own picks influence ELO; the rank shown in the reveal reflects the pre-vote leaderboard state because `/api/stats` races with `POST /api/vote`. Acceptable — sub-vote staleness is invisible to the user. Confirmed in design discussion.
- **Sound on iOS.** WebAudio on iOS Safari requires user-gesture initialization (`audioContext.resume()` on first interaction). Handle this in the first card click; subsequent plays just `start()` against the running context.

## Migration Plan

No data migration. Behavior changes activate on the next deploy. The retired `STORAGE_LOCAL_VOTES` localStorage key will linger in user browsers — harmless and self-clearing as users clear cache. No code path reads it after this change.
