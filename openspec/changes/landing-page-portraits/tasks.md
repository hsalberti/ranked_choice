## 1. Copy + markup (index.html)

- [x] 1.1 In `#screen-start`, replace the subhead text with: *"Rank them, see each candidate's ELO. Understand your preferences."*
- [x] 1.2 Rename the `#start-preview` container's class from `preview` to `roster` (or add `roster` alongside `preview`) so CSS rules can target the new grid layout without colliding with the legacy `.hero .preview .avatar` overlap rules.
- [x] 1.3 Leave the H1, `.start-meta` row ("· 25 candidates · ~2 minutes · no signup"), and "Start voting →" CTA unchanged.

## 2. Roster-selection logic (app.js)

- [x] 2.1 Add a `rosterPreviewSet()` helper that returns the first 25 candidates from `[...TIER[1], ...TIER[2]]` in declaration order (slicing to length 25).
- [x] 2.2 Add a `shufflePartyMixed(arr)` helper: Fisher–Yates shuffle followed by a pass that detects any run of 3+ consecutive same-party items and swaps the offending item with the next later item of a different party. Cap at 50 swap iterations.
- [x] 2.3 Rewrite `renderStartPreview()` (`app.js:424`) to compute `shufflePartyMixed(rosterPreviewSet())` and render each candidate via `avatarHtml(c, 'roster')` (new size flag — see task 3.2).
- [x] 2.4 Verify `renderStartPreview()` is still called from the same place(s) as today (no flow changes). Confirmed: still called once at boot (`app.js:1916`).

## 3. Avatar size + party ring (styles.css)

- [x] 3.1 Confirm `avatarHtml`'s `sizeClass` branch handles the new `'roster'` size flag — extend the helper if needed to append a ` roster` class (`app.js:415`).
- [x] 3.2 Add `.avatar.roster` rules: width/height 60px (mobile) / 72px (desktop ≥ 900px breakpoint), with font-size adjusted proportionally for the initials fallback.
- [x] 3.3 Add party-ring rules via `box-shadow: inset 0 0 0 3px rgba(255,255,255,0.4), 0 0 0 3px var(--rep|--dem|--ind)`. Inner highlight is part of the same box-shadow so it composes cleanly.
- [x] 3.4 Verify the ring renders cleanly on `.avatar.has-photo` — box-shadow is drawn outside the rounded clipping mask, so no clipping issues.

## 4. Grid layout (styles.css)

- [x] 4.1 Replace the existing `.hero .preview` rules with `.hero .roster` rules: `display: grid`, `grid-template-columns: repeat(5, 1fr)`, gap 10px, `justify-items: center`, `max-width: 360px`, `margin: 28px auto 32px`. Forces a clean 5×5 grid.
- [x] 4.2 Desktop @media (min-width: 900px) overrides: 5-column grid at 72px portrait size, `gap: 14px`, `max-width: 520px`.
- [x] 4.3 Legacy `.hero .preview` and `.hero .preview .avatar` rules fully removed (the `.preview` class is no longer in the DOM).
- [x] 4.4 Confirm the CTA, `.start-meta` row, and roster grid all remain visible above-the-fold on a 390×844 (iPhone 14) viewport. Verified via headless Chrome screenshot.

## 5. Accessibility check

- [x] 5.1 Verify all roster portraits render with `aria-hidden="true"` (already provided by `avatarHtml`).
- [x] 5.2 Verify roster portraits are not focusable (no `tabindex`, no `role="button"`).
- [x] 5.3 Verify clicking a roster portrait does nothing — only mention of `#start-preview` in `app.js` is inside `renderStartPreview()` itself; no event listeners.

## 6. Visual + manual QA

- [x] 6.1 Ran a local static server (python `http.server`) and loaded the start screen in headless Chrome.
- [x] 6.2 Confirmed exactly 25 portraits render (DOM dump showed 25 `.avatar.lg` elements).
- [x] 6.3 Confirmed across multiple reloads: order varies; no 3-in-a-row same-party in the rendered party sequence (verified by dumping `party-[RDI]` classes).
- [x] 6.4 Confirmed red (R), blue (D), and grey (I) rings render correctly in the screenshot.
- [x] 6.5 Confirmed subhead text matches exactly: *"Rank them, see each candidate's ELO. Understand your preferences."*
- [x] 6.6 Confirmed portrait size (60px mobile / 72px desktop) is visibly larger than the prior 44/56px overlap stack.
- [x] 6.7 Tested at 360×800 (narrow) — 5-column grid still fits, CTA stays visible.
- [x] 6.8 `#start-btn` click handler at `app.js:1653` is unchanged; CTA still advances to the vote screen.

## 7. Implementation notes (during apply)

- [x] 7.1 **Class-name collision fix:** Initial implementation used `roster` as both the grid-container class (`.hero .roster`) AND the avatar size flag (`.avatar.roster`). Because `.hero .roster` is a descendant selector, it matched every avatar (which also had the `roster` class) and overrode `display: flex` with `display: grid` — collapsing the inner `<img>` to ~4px wide. Fixed by renaming the size flag to `lg` (`.avatar.lg`); the container keeps `.roster`.
- [x] 7.2 **Shuffle algorithm replaced:** The initial swap-pass algorithm couldn't fully resolve 3-runs when one party dominates (14 R out of 25). Replaced with a bucket-based picker that, at each step, picks weighted-randomly from the non-blocked parties, with a "forced" override when one bucket would overflow the remaining slots. This both eliminates 3-runs and distributes the rare Independents across the grid instead of stranding them at the end.
