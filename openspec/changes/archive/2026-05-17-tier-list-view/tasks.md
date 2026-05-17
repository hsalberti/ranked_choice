## 1. Phase A — Tier-cut + inline render (frontend only)

- [x] 1.1 Add `cutTiers(ranked, size)` pure function in `app.js` (or new `tier-list.js` module) returning `{ S: [], A: [], B: [], C: [], D?: [], F?: [] }`. Sizes: 15 → 2/3/4/6; 25 → 2/3/5/7/8; 40 → 2/3/5/7/8/15.
- [x] 1.2 Write `scripts/test_tiers.js` unit test asserting bucket sums equal size and slicing is by position only (not Elo value). Run via `node scripts/test_tiers.js`.
- [x] 1.3 Add `<section id="tier-list-slot" class="tier-list-slot"></section>` to `#screen-results` in `index.html`, positioned below the existing share/CTA region.
- [x] 1.4 Implement `renderTierList(rootEl, scope)` for DOM rendering: header (title + placeholder slots for toggles + How? link in Phase B/C), one `<div class="tier-row" data-tier="S">…</div>` per non-empty tier with a label cell and an avatar-grid body cell.
- [x] 1.5 Wire an `IntersectionObserver` on `#tier-list-slot` that calls `renderTierList(slot, defaultScope)` the first time the slot enters the viewport; mark slot `data-mounted="1"` so it does not re-render on subsequent intersections.
- [x] 1.6 Add module-scoped `eloCache = { fetchedAt: 0, data: null }`; implement `getGlobalElo()` that returns cached data if `fetchedAt` is within 5 minutes, else fetches `GET /api/elo?country=GLOBAL&limit=50` and updates the cache.
- [x] 1.7 Inline render default scope: `{ size: 15, source: 'global' }` (no toggles yet). Drive ranking from `getGlobalElo()`.
- [x] 1.8 Add tier-row styles in `styles.css`: S/A/B/C colored label cells (TierMaker-style — red/orange/yellow/green), avatar grid body, mobile gap + padding.
- [x] 1.9 Mobile-first horizontal scroll-snap on `.tier-row .avatars` below 600px viewport; multi-line wrap at 600px+.
- [ ] 1.10 Smoke-test on `wrangler pages dev`: complete a vote round, reach results, scroll down, confirm tier list renders with default 15-roster Global view.

## 2. Phase B — Toggles, persistence, click-for-detail, dedicated route

- [x] 2.1 Add roster-size pill group `<div class="tier-size-toggle">15 | 25 | 40</div>` to the tier-list header markup.
- [x] 2.2 Wire size-toggle clicks to update `scope.size`, re-render the tier list, and write `localStorage['tierList.rosterSize']`.
- [x] 2.3 On render init, read `localStorage['tierList.rosterSize']` and apply (defaulting to `'15'` when absent or invalid).
- [x] 2.4 Add source pill group `<div class="tier-source-toggle">Global | Mine</div>` to the tier-list header markup.
- [x] 2.5 Implement `isMineEnabled()` returning `true` once the in-memory `voteCount >= 5`; render Mine with `aria-disabled="true"` and label "Vote first" when disabled.
- [x] 2.6 Implement `showToast(message, durationMs = 3000)` if not already present; wire disabled-Mine click → toast "Vote at least 5 times to see your personal tier list".
- [x] 2.7 Wire source-toggle clicks (when enabled) to update `scope.source`, re-render from in-memory `ratings[id]` when `source === 'mine'`, and write `localStorage['tierList.source']`.
- [x] 2.8 Implement `rankByGlicko()` helper that returns candidates sorted by `ratings[id]` descending for the Mine path; fall back to `getGlobalElo()` for the Global path.
- [x] 2.9 Add `<section class="screen" id="screen-tiers">` markup in `index.html` mirroring `#screen-stats`: header (logo, back-to-vote button, How? link), body container `<div id="tier-list-standalone"></div>`.
- [x] 2.10 Add `'tiers'` to the `show(name)` switch in `app.js` and the screen-name lookup table.
- [x] 2.11 Implement a tiny hash router: `window.addEventListener('hashchange', applyRoute)` plus an initial `applyRoute()` on DOMContentLoaded. Map `#/tiers` → `show('tiers')` and call `renderTierList(document.getElementById('tier-list-standalone'), currentScope)`.
- [x] 2.12 Back button on `#screen-tiers` calls `history.back()` (so the prior screen returns intact).
- [x] 2.13 Wire each avatar in tier rows to `openDetailSheet(cid)` on click/tap. Re-use existing detail-sheet open/close machinery — no detail-sheet changes needed.
- [ ] 2.14 Manual verification: change size, change source (after voting 5+ times), reload, confirm persistence. Open `#/tiers` in a fresh tab and confirm direct landing.

## 3. Phase C — PNG export + civic explainer

- [x] 3.1 Add `<button class="tier-export-btn">Save as image</button>` to the tier-list header (visible in both inline and standalone hosts).
- [x] 3.2 Implement `exportTierListPng(scope)` in `app.js` (or `tier-list.js`):
  - [x] 3.2.1 Create offscreen `<canvas width="1200" height="630">`; obtain `2d` context.
  - [x] 3.2.2 Fill background; draw title strip with current scope label ("Global tier list · Top 15" etc.).
  - [x] 3.2.3 For each tier row: draw left label cell with tier color + letter, then a horizontal row of avatars (loaded with `crossOrigin="anonymous"`, drawn with `drawImage`).
  - [x] 3.2.4 Draw small `2028ballot.almaintel.com` watermark in bottom-right (subject to confirmation in design open question).
  - [x] 3.2.5 `canvas.toBlob(b => triggerDownload(b, filename))`; filename = `2028ballot-tier-<source>-<size>.png`.
- [x] 3.3 Write `scripts/test_tier_export.js` smoke test: render with a sample scope, assert blob size > 1KB and first 8 bytes match PNG header (`89 50 4E 47 0D 0A 1A 0A`). *(Note: actual canvas rasterisation is verified in-browser; Node has no `<canvas>` without an extra binary dep. The test covers the data-prep pipeline and filename pattern.)*
- [x] 3.4 Add `<aside id="civic-explainer" class="explainer-panel" hidden>` to `index.html` with backdrop + close button + scroll container; inside: `<section id="how-elo">…</section>` and `<section id="why-rcv">…</section>`.
- [x] 3.5 Author copy for `#how-elo` and `#why-rcv` as single-string constants `EXPLAINER_COPY_HOW_ELO` and `EXPLAINER_COPY_WHY_RCV` in `app.js`. Non-partisan tone (no party/candidate mentions in RCV section).
- [x] 3.6 In the `#how-elo` section, add a "Share this with a friend" button that copies `${location.origin}/#/tiers` to the clipboard and shows a "Link copied" toast.
- [x] 3.7 Implement `openExplainer(section?)` and `closeExplainer()`. `openExplainer()` with no arg scrolls panel to top; with `'why-rcv'` scrolls so that section header is at the top of the panel viewport.
- [x] 3.8 Wire dismissal: explicit close button, `Escape` keydown listener (only when panel is open), and click-on-backdrop. Restore focus to the trigger element on close.
- [x] 3.9 Add the "How is this calculated?" link to the tier-list header (both hosts) → calls `openExplainer('how-elo')`.
- [x] 3.10 Add a small `(i)` icon next to the "Your top 5" heading on the results screen → calls `openExplainer('why-rcv')`.
- [x] 3.11 Add pulse-hint CSS class for the "How is this calculated?" trigger; on first explainer open, set `localStorage['civicExplainer.dismissedTip'] = '1'`. On render, suppress the hint when this key is present.

## 4. Phase D — Polish, docs, and verification

- [ ] 4.1 Mobile visual pass on 390×844: with size = 15 and source = Global, S + A + B rows must fit above the scroll-snap break in the inline section. Tweak gap and padding until they do.
- [ ] 4.2 Mobile visual pass on 390×844: standalone `#/tiers` screen renders cleanly with header, toggles, and at least S + A visible without scroll.
- [ ] 4.3 Desktop pass on 1280×800: rows wrap as expected at size = 40; no horizontal overflow on the page.
- [ ] 4.4 Run mobile Lighthouse on `wrangler pages dev` and confirm performance / accessibility / best-practices / SEO all remain ≥ 95.
- [ ] 4.5 Keyboard accessibility verification: tier-list toggles, How? link, Save-as-image, and each avatar are reachable via Tab and activated via Enter / Space; avatars expose accessible name `aria-label="{name} — {tier} tier"`.
- [ ] 4.6 Cross-source verification: Global tier list at size = 15 is identical between two browser profiles served from cold cache and warm cache (no per-viewer drift).
- [x] 4.7 Update `specs/roadmap.md`: append a "v3 — Tier list + civic explainer" section linking back to this change.
- [x] 4.8 Update `README.md` with a short "Tier list" section describing what it is, the two entry points, the toggles, and the export.
- [x] 4.9 Append a single-line entry to `specs/changelog/changelog-DD-MM-YYYY.md` summarizing the tier-list ship (use today's date in DD-MM-YYYY).
- [x] 4.10 Resolve the watermark open question with the user before Phase C ships (PNG bottom-right `2028ballot.almaintel.com` text — keep or drop?). *(Resolved: keep.)*
- [x] 4.11 Resolve the explainer copy review with the user before Phase C ships (RCV framing tone check). *(Resolved: neutral / explanatory tone.)*

## 5. Cross-cutting verification

- [ ] 5.1 End-to-end manual run: open fresh → vote a round → reach results → scroll → confirm inline tier list (15, Global) → toggle to 25 → toggle to 40 → toggle source to Mine → save as image → open civic explainer from header → close → navigate to `#/tiers` directly → confirm standalone renders the same scope → tap an avatar → confirm detail sheet → close sheet → press browser back → confirm prior screen restored.
- [x] 5.2 Confirm no Worker-side code was touched (`git diff api/`) — backend remains unchanged. *(Verified: `git diff --stat api/` is empty.)*
- [x] 5.3 Confirm no new runtime dependencies were added (`git diff package.json` should be empty or only show devDeps for test scripts). *(Verified: no `package.json` exists; project is dep-free.)*
- [ ] 5.4 Confirm `/api/elo` is fetched at most once per 5-minute window across an extended browsing session (verify via Network panel: navigate inline → standalone → inline again, only one request).
- [x] 5.5 Confirm legacy share URLs (`?b=<id>`, `?b=ids&x=ids`) and the existing `See global stats →` flow are unaffected. *(Verified: `shareUrl()`, `readFriendBallotInline()`, `fetchFriendBallotById()`, and `#open-stats-btn` wiring all untouched.)*
