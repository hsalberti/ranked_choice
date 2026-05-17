## Context

The frontend is a single-page Cloudflare Pages app (`index.html` + `app.js` + `candidates.js` + `styles.css`) with four existing top-level screens managed by the `show(name)` switcher: `#screen-start`, `#screen-vote`, `#screen-results`, `#screen-stats`. The in-flight `smart-matchups-crowd-elo` change already added Glicko-2 ratings (per-user, in memory) and a `GET /api/elo` endpoint that returns crowd Elo per `(candidate_id, country)` with party + n_ballots fields. Avatars are static first-party PNGs under `/web/assets/avatars/`. There is no router today — `#screen-stats` is reached only via an explicit button click on the results screen.

This change adds a fifth visual surface — a tier-list rendering — that needs two entry points (inline below results, and standalone at `/tiers`), a couple of toggles, an export, and a reusable explainer panel that also covers ranked-choice voting basics for civic literacy.

Constraints carried from the existing phases:
- No third-party trackers or new runtime deps; cookieless first-party only.
- Free Cloudflare tier; client-side compute where possible.
- Anonymous-by-default — no accounts; preferences live in `localStorage`.
- Mobile-first: 390×844 must look right; the tier-list rows must scroll-snap horizontally on narrow viewports.
- Lighthouse mobile scores ≥ 95 across performance / accessibility / best-practices / SEO must remain green after this change.

The TierMaker visual reference (S/A/B/C/D/F horizontal rows with colored left labels and avatar-grid bodies) is well-known to the streamer cohort this change targets; that aesthetic is the design anchor.

## Goals / Non-Goals

**Goals:**
- Give post-vote viewers a visually rich, instantly recognisable artifact to react to, share, and screenshot.
- Make the tier-list deterministic and identical for every viewer at a given roster size + source — no surprises when comparing.
- Surface crowd-Elo's existence and how it works in plain English without leaving the page (raises trust and dwell time).
- Educate visitors briefly on ranked-choice voting at the moment they're already engaged with a ranking-themed surface.
- Ship as additive layers on top of the existing screen architecture — no churn to the vote engine, the API, or the share/results layout decisions made in `smart-matchups-crowd-elo`.

**Non-Goals:**
- An OBS browser-source "overlay mode" with transparent background and no chrome. Deferred — see Open Questions.
- Drag-and-drop "build your own tier list" interactivity à la TierMaker proper. Tiers here are *computed*, not authored.
- Server-side tier rendering or a dedicated `/api/tiers` endpoint. Tiers are derived client-side from `/api/elo` (Global) or in-memory Glicko (Mine).
- A separate Pages route with prerendered SSR shell for `/tiers`. We stay on hash-routing in v1.
- An "F tier" pejorative framing in the explainer — labels are descriptive (top/middle/bottom buckets) regardless of label letters.
- Multi-language UI; copy stays English-only.
- Persistent personal tier history or cross-device sync (still Phase 7+).

## Decisions

### 1. Fixed-count tier cut, parameterised by roster size

**Decision:** Tiers are cut by *position*, not by Elo gap. The bucket sizes are:
- `15` → S=2, A=3, B=4, C=6
- `25` → S=2, A=3, B=5, C=7, D=8
- `40` → S=2, A=3, B=5, C=7, D=8, F=15

The cut function is a pure function `cutTiers(ranked: Candidate[], size: 15|25|40): TierMap`. It does not look at Elo values; it only takes the top-N already-sorted list and slices.

**Why:** Two viewers comparing tier lists at the same size must see identical groupings — debates like "is X really C tier?" depend on a stable visual anchor. Elo-gap-based cuts (e.g., "break tiers wherever the largest rating gap is") shift bucket sizes between viewers, breaking that anchor and adding implementation complexity (gap detection, minimum-tier-size guards). The user's original sketch was already in fixed-count form; we honor it.

**Alternatives considered:**
- *Elo-gap-based cuts* — produces "more meaningful" tier boundaries but at the cost of unpredictable layout. Rejected on shareability grounds.
- *Hybrid (target counts ±1 for gap clarity)* — adds a knob with no clear win condition. Rejected.

### 2. Roster-size toggle (15/25/40) defaults to 15 and persists in localStorage

**Decision:** Three pill buttons in the tier-list header, top-right: `15` (default), `25`, `40`. Selection writes `tierList.rosterSize` to `localStorage` and is read on next mount.

**Why:** 15 is the cleanest tier-cast for the streamer use case (4 visible rows, no D/F pejoratives, fits a 390px-wide phone above the fold). 25 covers everyone on the headline vote pool and avoids "where's X?" confusion. 40 is for the completist viewer who wants to see the full ballot ranked.

**Alternatives considered:**
- *Hide the toggle; pick size based on viewport* — non-discoverable; surprises users.
- *Single fixed size (15 or 25)* — leaves one strong use case unserved.

### 3. Source toggle: Global (default) vs Mine

**Decision:** Two pill buttons next to the size toggle: `Global` (default) and `Mine`. `Global` reads from a cached `GET /api/elo?country=GLOBAL&limit=50` response; `Mine` reads from the in-memory `ratings[id]` Glicko ratings already maintained by `app.js`. `Mine` is disabled and labeled "Vote first" until the user has at least 5 personal votes recorded; if disabled and clicked, a toast explains why.

**Why:** Global is the shareable, party-trick view that streamers will reach for first. Mine answers the immediate "but did *I* rank them like that?" question without needing a separate compare view. Defaulting to Global avoids the embarrassing zero-state where a fresh visitor sees a tier list with all candidates tied at 1500.

**Alternatives considered:**
- *Default to Mine post-vote, Global elsewhere* — added conditional logic with little payoff. The toggle is cheap.
- *Show both side-by-side* — doesn't fit on a 390px viewport without becoming illegible. Rejected.

### 4. Two entry points, one component

**Decision:** Build the tier list as a single render function `renderTierList(rootEl, scope)` invoked from two hosts:
- **Inline**: a `<section id="tier-list-slot">` appended to `#screen-results` below the existing share/CTA region. Lazily mounted on first scroll into view via `IntersectionObserver` to avoid paying the render cost when the user shares-and-leaves.
- **Standalone**: a new screen `#screen-tiers` reachable via hash route `#/tiers` (or `?screen=tiers` fallback). The screen has its own header (logo, back-to-vote, How? link) and renders the same `renderTierList` into its body.

**Why:** One component, two hosts is the minimum-duplication shape. Inline lives where the streamer will encounter it naturally; the dedicated route gives a shareable link and a pre-built canvas for the future OBS overlay mode.

**Alternatives considered:**
- *Modal/sheet instead of inline* — breaks scroll narrative on results and constrains height. Rejected.
- *Two separate components (inline-compact + full)* — duplicates logic, drifts. Rejected.

### 5. Hash-based routing for `/tiers`

**Decision:** Add a tiny router in `app.js` that listens to `hashchange` and maps `#/tiers` → `show('tiers')`, with `#/stats` and bare `#` mapped to existing screens for symmetry. Cloudflare Pages serves `index.html` for any unmatched path, but we don't add real Pages routes in v1.

**Why:** Hash routing is zero-infra and zero-config on Cloudflare Pages; works in `wrangler pages dev`; preserves the existing entry-via-button path because the router is additive. A real `/tiers` Pages route would require either prerender setup or a server function to inject OG tags, which is out of scope for v1.

**Alternatives considered:**
- *History API + Pages route* — better for social card previews but adds deploy complexity. Defer to v3.1 if the route sees real traffic.
- *Query-string param only (`?screen=tiers`)* — works but less recognisable as a "page". Rejected.

### 6. PNG export via `<canvas>` snapshot, no external lib

**Decision:** "Save as image" button triggers a render of the tier list into an offscreen 1200×630 `<canvas>` using direct 2D drawing primitives — `drawImage` for avatars, `fillText` for tier labels and titles — then calls `canvas.toBlob('image/png')` and triggers a download. The drawing routine reads the same `cutTiers` output and avatar URLs as the DOM render. No `html2canvas` or `dom-to-image` dependency.

**Why:** Vendoring `html2canvas` would add ~50 KB gzipped and a runtime that's flaky with cross-origin avatars and modern CSS. A hand-rolled canvas draw is ~150 LOC for a fixed-layout grid and gives us exact control over typography, padding, and watermark. 1200×630 is the Open Graph card aspect ratio, so the PNG can double as a social-share image.

**Alternatives considered:**
- *Server-side render via Worker* — extra round-trip, extra cold-start latency, more Worker code to maintain. The existing `/api/og` endpoint is for *ballot* OG cards; tier-list rendering is fundamentally a different layout and adding a second canvas-renderer in the Worker doubles the maintenance surface.
- *`html2canvas`* — bundle weight + cross-origin pitfalls. Rejected.
- *SVG → `serializeToString` → `data:` URI* — works but produces large files and doesn't bake fonts. Rejected.

### 7. Civic-explainer as its own capability, not a tier-list-only modal

**Decision:** The "How is this calculated?" panel is a standalone reusable component (`#civic-explainer`) with two sections deep-linkable by anchor: `#how-elo` and `#why-rcv`. Any host can open it via `openExplainer(section?)`. Initially it's wired up from two surfaces — the tier-list header and a small (i) icon next to "Your top 5" on the results screen header — but the capability is designed to be reachable from anywhere.

**Why:** Civic literacy on ranked-choice voting is a wider site concern than just the tier-list view. Keeping the panel separate lets future surfaces (the vote screen's onboarding, an FAQ page, etc.) open it without coupling them to tier-list code. Two-section structure mirrors the two questions a confused viewer actually asks ("how did you rank them?" and "what's ranked-choice anyway?").

**Alternatives considered:**
- *Inline collapsible `<details>` blocks per screen* — duplicates copy across surfaces, drifts. Rejected.
- *Link out to a Notion/Substack post* — leaves the site, breaks the "anonymous, no-tracker" framing. Rejected.

### 8. Personal source uses in-memory Glicko, not localStorage

**Decision:** The "Mine" tier list reads from the `ratings`, `rd`, `sigma` maps already maintained in `app.js` memory by the Glicko-2 update step. Nothing is persisted to localStorage. If the user reloads, Mine resets to the disabled "Vote first" state until they vote 5 more times in the new session.

**Why:** Persisting partial Glicko state across sessions opens questions ("is my data still current after a new vote?") and would require us to expose an "I'm starting over" affordance. The session-bounded behavior matches the rest of the app (ballot state is session-bounded too — only the final ballot is persisted server-side after the user shares it).

**Alternatives considered:**
- *Persist Glicko snapshot in localStorage* — invites stale-data confusion across multi-day sessions. Rejected for v1; reconsider in Phase 7 alongside the sign-in story.

### 9. Min-vote floor for enabling "Mine"

**Decision:** Mine is enabled once the in-memory `voteCount >= 5`. Below that, the button is rendered with `aria-disabled="true"` and label "Vote first". Tapping it shows a transient toast "Vote at least 5 times to see your personal tier list" (3-second auto-dismiss).

**Why:** Five votes is the minimum where the tier-cut produces visibly different results from the all-tied 1500 starting state under Glicko-2. Below five, "Mine" would either look identical to alphabetical or show alarming swings from single votes.

**Alternatives considered:**
- *Show Mine but visually flag low-confidence rows* — adds visual noise; users will still screenshot the misleading early state.
- *Use Glicko RD threshold instead of vote count* — more principled but harder to explain in a toast.

### 10. Caching `/api/elo` response

**Decision:** On first inline-mount or `/tiers` open, fetch `GET /api/elo?country=GLOBAL&limit=50` and cache the response in a module-scoped variable for 5 minutes. Toggling source/size operates on the cached data; switching country (later — not in v1) would re-fetch.

**Why:** The global Elo doesn't shift meaningfully on a sub-minute timescale. Avoiding refetches on every toggle keeps the toggle response snappy and reduces Worker load. Five minutes is well inside the human attention span for a single visit.

**Alternatives considered:**
- *No client cache, refetch every render* — wasteful and laggy on slow connections.
- *Service-worker cache with stale-while-revalidate* — overkill for v1; adds a service worker we don't currently ship.

## Risks / Trade-offs

- **Mine tier list is misleading early in a session** → Disabling below 5 votes and showing an explanatory toast (Decision 9). If real-traffic data shows users still feel the early state is broken, raise the floor to 8.
- **PNG export font rendering varies across browsers** → Canvas `fillText` uses the system font stack and won't pixel-match the DOM render. Mitigation: bundle a single web-safe font (we already use Inter) and set it explicitly on the canvas context; accept ~1px hinting differences across OSes.
- **PNG export bundles avatar images** → Each avatar must be loaded with `crossOrigin="anonymous"` so the canvas isn't tainted; verified all avatars are first-party static assets so CORS isn't an issue. If we ever switch to a CDN-hosted avatar source, the CDN must serve `Access-Control-Allow-Origin: *`.
- **Hash routing breaks browser-extension intercepts and some screen-reader URL announcements** → Acceptable for v1 given the zero-infra trade. The dedicated standalone URL is reachable as `https://2028ballot.almaintel.com/#/tiers`. Re-evaluate when Pages route + prerender comes online.
- **Inline tier list lengthens the results page significantly** → Verified: at 40-roster size, the section is ~1100px tall on mobile, which doubles the results-screen scroll length. Mitigation: the section is lazily mounted on `IntersectionObserver`, so users who share-and-leave never pay the render cost. The default 15-roster size keeps the inline section under 500px.
- **Civic explainer copy is opinionated** → Ranked-choice voting framing is intentionally non-partisan ("electing what most people want") but reviewers may flag tone. Mitigation: copy is in a single string constant in `app.js`, easy to revise post-launch; the spec includes a content-review checkpoint.
- **Lighthouse performance might dip from PNG export listener / canvas init** → Defer canvas-related JS until the export button is first focused (lazy init), so the cold-start path doesn't grow.

## Migration Plan

This change ships in 4 deployable phases, each independently revertible.

1. **Phase A — Tier-cut + inline render (frontend only).**
   - Add `cutTiers(ranked, size)` pure function and unit test (`scripts/test_tiers.js`).
   - Add `#tier-list-slot` to `#screen-results` markup.
   - Implement `renderTierList(rootEl, scope)` for DOM rendering (S/A/B/C/D/F rows, avatar-grid bodies).
   - Wire `IntersectionObserver` for lazy mount.
   - Default scope: `{ size: 15, source: 'global' }`. No toggles yet — those land in Phase B.
   - Pre-fetch `/api/elo?country=GLOBAL&limit=50` cache on results-screen mount.
   - **Revert:** remove the `#tier-list-slot` element and the observer wiring.

2. **Phase B — Toggles, persistence, click-for-detail, dedicated route.**
   - Add roster-size pills (15/25/40), wire to `localStorage['tierList.rosterSize']`.
   - Add source pills (Global/Mine), wire to `localStorage['tierList.source']` and the 5-vote enablement floor.
   - Add `#screen-tiers` markup mirroring `#screen-stats`.
   - Add hash router in `app.js`; map `#/tiers` → `show('tiers')`. Add `'tiers'` to the `show()` switch.
   - Wire avatar click → `openDetailSheet(cid)`.
   - **Revert:** drop the toggles and the `#screen-tiers` section; the inline tier list keeps its default-scope rendering.

3. **Phase C — PNG export + civic explainer.**
   - Implement `exportTierListPng(scope)` (~150 LOC of canvas drawing) with unit-level visual smoke test (`scripts/test_tier_export.js`: render → blob → assert non-zero size + PNG header bytes).
   - Add `Save as image` button to the tier-list header in both hosts.
   - Implement `#civic-explainer` panel markup, copy for `#how-elo` and `#why-rcv`, open/close logic.
   - Add `How is this calculated?` link to tier-list header and an `(i)` icon next to "Your top 5" on the results screen.
   - **Revert:** remove the export button and the explainer button-trigger sites; the panel markup can stay dormant.

4. **Phase D — Polish + docs.**
   - Mobile visual pass at 390×844 for the 15-roster default inline tier list (must fit S+A+B above the scroll-snap break).
   - Lighthouse mobile re-check; target ≥ 95 across all four categories.
   - Add `?overlay=1` query-string detection that hides chrome on `#screen-tiers` (stretch — see Open Questions); if cut, mark in the Open Questions section as deferred.
   - Update `specs/roadmap.md` with a "v3 — Tier list + explainer" entry.
   - Append a single-line entry to today's `specs/changelog/changelog-DD-MM-YYYY.md`.
   - **Revert:** none required; Phase D is documentation and verification.

**Rollback strategy:** Each phase is a separate PR. A through D can be reverted independently; Phase C depends on Phase A+B markup existing. No backend or schema changes anywhere in this change — Worker code is untouched. If something breaks production, revert the Pages deploy and the previous build is back in seconds.

## Open Questions

- **OBS overlay mode (`?overlay=1`).** Stretch goal for streamers: a flag on `/tiers` that hides nav, makes the background transparent, and locks the size at 1280×720. Defer to a follow-up unless a streamer asks for it within the first week of v3 launch.
- **PNG watermark.** Should exported PNGs include a small `2028ballot.almaintel.com` watermark in the bottom-right corner? Lean yes for discoverability; confirm with user before Phase C.
- **Personal tier list persistence.** Whether to persist Glicko state across sessions (Decision 8 says no for v1). Re-evaluate once sign-in lands in Phase 7+.
- **Country dimension on tier list.** Could mirror the stats-screen country filter. Deferred — the source toggle (Global/Mine) is already two dimensions; adding country triples the matrix and clutters the header. Revisit if there is real traffic asking for it.
- **Explainer copy review.** "Why ranked choice?" framing should be reviewed before Phase C ships to make sure the tone reads non-partisan to readers across the spectrum.
- **Avatar 2x assets for PNG export.** Today's avatars are sized for screen; the 1200×630 PNG may render them slightly soft. If feedback flags this, add a 2x avatar build step under `/web/assets/avatars/2x/`.
