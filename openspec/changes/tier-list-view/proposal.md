## Why

Streamers and creators are a high-leverage cohort: a single play-through on stream can drive hundreds of follow-on ballots, but the current results screen — a top-5 list plus share buttons — gives them nothing visually rich to react to once their personal ballot is in. The TierMaker tier-list format (S/A/B/C rows of avatars) is the lingua franca of reaction-content on Twitch/YouTube; offering one rendered from our crowd Elo turns "I voted" into "look at this Tier B chaos" with no extra work from the viewer. Adding a plain-English explainer of *how* the tiers are calculated (Elo) and *why* ranked-choice matters at all also raises the civic-literacy ceiling for the same audience.

## What Changes

- **Tier-list view.** A new visual surface that renders candidates into labeled tier rows (S / A / B / C, plus D and F when expanded). Default cut: S = top 2, A = next 3, B = next 4, C = next 6 (15 total). The cut is *fixed-count*, not Elo-gap-derived, so the layout is identical for every viewer at a given size.
- **Roster-size toggle (top-right).** Three buttons: `15` (default, S2/A3/B4/C6), `25` (adds D8 to cover all headline candidates), `40` (adds D8 + F15 for the full ballot). Selection persists in `localStorage`.
- **Ranking-source toggle.** Two buttons: `Global` (default — driven by `GET /api/elo` aggregate) and `Mine` (driven by this session's client-side Glicko ratings). Disabled and labeled "Vote first" when the user has no personal ratings yet.
- **Two entry points sharing one component.** (1) Scroll-revealed below the existing `#screen-results` content — appears as the user scrolls past the share buttons and stats CTA. (2) Dedicated `/tiers` route (SPA-routed; same component, full viewport) for direct linking and OBS browser-source use.
- **PNG export.** A "Save as image" button generates a 1200×630 PNG of the current tier list (current roster size + source). Implemented client-side via `<canvas>` snapshotting; no Worker round-trip needed. Filename: `2028ballot-tier-{global|mine}-{15|25|40}.png`.
- **Candidate click → detail card.** Tapping or hovering an avatar opens the existing `openDetailSheet(cid)` overlay (name, party, country, current Elo, n_ballots) without leaving the tier-list view.
- **Civic explainer panel.** A persistent "How is this calculated?" link near the tier-list header opens a side panel / modal with two sections: (1) *How tiers are computed* — plain-English description of pairwise voting → Elo → tier-cut, with a "Share this with a friend" link to `/tiers`, and (2) *Why ranked choice?* — short explainer on how ranked-choice voting elects what most people want vs. 50%+1 plurality. Same panel is reachable from the `/tiers` route header.
- **Result-screen wiring.** The existing results screen grows a "scroll for tier list ↓" cue and renders the tier-list component inline below the share/CTA region. The existing stats CTA, share buttons, and tier-progression CTA are unchanged.

## Capabilities

### New Capabilities
- `tier-list-view`: TierMaker-style visual ranking of candidates into named rows (S/A/B/C/D/F) driven by crowd or personal Elo. Owns the tier-cut algorithm (fixed-count by roster size), the roster-size toggle (15/25/40), the source toggle (Global/Mine), the inline-on-results placement, the dedicated `/tiers` route, the candidate-card → detail-sheet wiring, and the PNG export.
- `civic-explainer`: Reusable "How does this work?" panel covering (a) Elo-from-pairwise-votes and (b) ranked-choice voting fundamentals. Owns the panel markup, the trigger contract (any host surface can open it with an optional section anchor), and the shareable deep link to `/tiers`.

### Modified Capabilities
*(No existing archived specs to modify — `openspec/specs/` is still empty. The `ballot-results-page` capability is introduced by the in-flight `smart-matchups-crowd-elo` change; this change extends it inline by appending the tier-list component below the existing region, which is additive and does not modify any of that capability's requirements.)*

## Impact

- **Code (frontend):** `index.html` (new `#screen-tiers` markup mirroring `#screen-stats`, scroll-reveal slot under `#screen-results`, explainer panel markup, roster + source toggle controls); `app.js` (new `tier-list.js` module or inline section: tier-cut function, `renderTierList(scope)`, scroll-reveal intersection observer, `/tiers` route handler in the existing hash-router, PNG canvas exporter, explainer panel show/hide); `styles.css` (tier rows S/A/B/C/D/F with TierMaker-inspired color bands, avatar grid, side panel / modal, mobile-vs-desktop layout).
- **Code (backend):** None. `GET /api/elo` already returns the data needed for the Global source (party, n_ballots, elo per candidate); the tier-cut runs client-side. Personal Mine source uses in-memory Glicko ratings already maintained by `app.js`.
- **New deps:** None. PNG export uses `OffscreenCanvas` / `<canvas>.toBlob()`; no html2canvas or external library.
- **Routes:** Adds a single SPA route `/tiers` (hash-based to stay compatible with Cloudflare Pages static routing). Optional later phase: real Pages route with prerendered shell for better social-card behavior.
- **Specs / docs:** `specs/roadmap.md` gains a "v3 — Tier list + explainer" entry. `README.md` admin recipes get an `?overlay=1` URL example for OBS browser-source use (overlay mode is a stretch goal — see Open Questions).
- **Data:** No schema change. No migration.
- **localStorage keys added:** `tierList.rosterSize` (`"15" | "25" | "40"`), `tierList.source` (`"global" | "mine"`), `civicExplainer.dismissedTip` (`"1"` once the user has opened it once, so we stop pulsing the "How?" hint).
- **Risk:** "Mine" source can produce a sparse/weird tier list when the user has voted only a few rounds; mitigation in the spec (require N ≥ floor before enabling) is documented. PNG export of avatar images requires CORS-safe avatar URLs — verified that all current avatars are first-party static assets.
- **No user-visible URL breakage.** All current routes continue to resolve; `/tiers` is purely additive.
