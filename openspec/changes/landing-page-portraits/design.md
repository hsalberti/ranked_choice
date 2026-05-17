## Context

The start screen (`#screen-start` in `index.html`) currently shows a hero with:
- An H1 ("Who should run in 2028?")
- A one-sentence subhead pitching the share-as-Wordle angle
- A `#start-preview` row of 6 shuffled `sm`-size avatars (rendered by `renderStartPreview` in `app.js:424`)
- A "Start voting →" CTA
- A three-item `.start-meta` strip ("· 25 candidates · ~2 minutes · no signup")

Avatars are already rendered via `avatarHtml(c, size)` (`app.js:415`) and have party-tinted gradient backgrounds (`styles.css:467-469`). The `.avatar.has-photo` variant wraps an `<img>` from `window.CANDIDATE_PHOTOS`. Party color tokens `--rep`, `--dem`, `--ind` already exist.

The shipped roster (per `candidates.js`) is partitioned by `tier`: Tier 1 = 16 candidates, Tier 2 = 12, Tier 3 = 13. The start-meta has historically claimed "25 candidates" — a marketing number that matches the "≈ 25 head-to-head matchups" total voting flow, not a specific roster slice.

This change is presentation-only: HTML/CSS/JS on `#screen-start`. No backend, no API, no state.

## Goals / Non-Goals

**Goals:**
- Show 25 candidate portraits on the start screen — enough to convey "this is a real field," not a token preview.
- Make party affiliation legible at a glance via a visible border (red/blue/neutral) on each portrait.
- Avoid a party-clustered look — the grid should feel intermixed.
- Bump portrait size one step so the grid reads as a deliberate roster, not decorative chrome.
- Replace soft pitch copy with a concrete, three-beat description of what the app does.

**Non-Goals:**
- No changes to the voting screen, results, stats, or share flow.
- No new portraits, no roster changes, no new CANDIDATE_PHOTOS entries.
- No interactivity on portraits (no click-to-preview, no detail sheet) — they are presentational only on the start screen.
- No new responsive breakpoints beyond what's needed for the grid to look correct.
- No backend changes. No API contract changes. No D1 changes.

## Decisions

### 1. Which 25 candidates?

**Decision:** Use the union of Tier 1 + Tier 2, take the first 25 in declaration order (Tier 1 first — all 16 — then the first 9 of Tier 2 from `candidates.js`).

**Why:** The start-meta has long advertised "25 candidates" and the user's ask is "the 25 portraits." Tier 1 alone is only 16, which would force changing the meta count or under-delivering on the visible roster. Tier 1 + Tier 2 totals 28 — close to 25 but not exact. Taking the first 25 in declaration order means the headline 16 are guaranteed in, and the order in `candidates.js` (curated by the user) decides which Tier-2 names round out the visible set.

**Alternatives considered:**
- *All Tier-1 (16) only* — under-delivers; doesn't match "25 portraits."
- *All Tier 1 + Tier 2 (28)* — overshoots; requires copy change ("25" → "28") and the grid becomes harder to balance into clean rows.
- *Hardcode a list of 25 in `app.js`* — extra maintenance burden, duplicates roster truth that lives in `candidates.js`.

This decision is easy to revisit during `/opsx:apply` — it's a one-line `.slice(0, 25)` swap.

### 2. Party-coded border (not just background tint)

**Decision:** Add an explicit `border: 3px solid <party-color>` (or equivalent `box-shadow: 0 0 0 3px <party-color>`) on start-screen portraits, in addition to the existing party-tinted gradient background. Use `--rep` for `party-R`, `--dem` for `party-D`, `--ind` for `party-I`.

**Why:** The current avatar gradient is subtle and gets washed out behind a portrait `<img>` (which fills the avatar via `.avatar.has-photo`). A solid colored border is unambiguous and survives over any portrait content. The user explicitly asked for "blue or red borders according to the party."

**Implementation choice:** `box-shadow: 0 0 0 3px <color>` instead of `border` so the inner content size doesn't shift (border adds to width on `box-sizing: content-box`; the existing `.avatar.has-photo img` is sized to 100% so a `border` would cause a hairline of border-color leak from CSS rounding). Box-shadow draws the ring without affecting layout.

**Alternatives considered:**
- *Border-only* — works but slight layout-sizing risk with the photo `<img>` inside.
- *Outline* — doesn't follow `border-radius: 50%` consistently across browsers; box-shadow does.

### 3. Mixed-party order (no more than two consecutive same-party)

**Decision:** Shuffle the 25 portraits, then run a simple party-balancing pass that detects any "run" of 3+ consecutive same-party portraits and swaps offending items with a later item of a different party until no such run remains. Cap iterations at ~50 to avoid pathological loops; if cap is hit, accept the result.

**Why:** A naive `shuffle()` of a roster that's ~60% Republican will routinely produce clusters of 3-5 same-party portraits in a row, which visually reads as a partisan grouping. The "no more than two consecutive" rule is enough to break that perception without forcing a strict ABAB pattern (which would itself feel artificial).

**Alternatives considered:**
- *Strict alternation* — looks engineered; also impossible when party counts are imbalanced.
- *Sort by party then interleave* — same issue; loses the natural-feeling randomness.
- *Re-shuffle until no 3-run exists* — works but wasteful for small N; the swap pass is O(N).

### 4. Portrait size: one step up from `sm`

**Decision:** Introduce a new size flag `roster` (or reuse `sm` and override via grid-specific CSS) at ~64px on mobile / ~72px on desktop — between current `sm` (38px desktop / 56px mobile) and the default 96px.

**Why:** 25 portraits at the current `sm` size (44px in the preview rule) look like decoration. At 96px default size, 25 portraits would overflow the hero and become the page. ~64-72px hits a sweet spot — clearly readable as portraits, fits a 5×5 or 6×4 grid on desktop and a tighter grid on mobile, doesn't crowd the CTA.

**Implementation:** Prefer scoping the size via a `.hero .roster .avatar` rule rather than a new global `lg`/`md` flag, since "start-screen-roster" is the only place this size is used.

### 5. Grid layout

**Decision:** CSS grid with `grid-template-columns: repeat(auto-fit, minmax(64px, 1fr))` and `max-width` on the parent to bound the grid to ~5 columns on desktop. Center-align via `place-items: center`.

**Why:** Fluid grid keeps the layout responsive without manual breakpoints. `auto-fit` collapses to as many columns as fit; the `max-width` on `.hero .roster` (or its container) caps it visually. Avoids the current overlapping-stack treatment (`margin-left: -10px`) which doesn't scale to 25 items.

### 6. Copy

**Decision:** Replace the subhead with the exact line the user requested: *"Rank them, see each candidate's ELO. Understand your preferences."* Keep H1, start-meta, and CTA unchanged.

**Why:** Three beats — rank, see ELO, understand — map to the three product surfaces (voting → results → stats screen). It's also more concrete than the current Wordle-share pitch, which oversells social mechanics that already exist on the results page.

## Risks / Trade-offs

- **[25 isn't the natural roster cut] → Mitigation:** Decision #1 explicitly documents the "first 25 in declaration order" rule and the line of code is one `.slice(25)`. Easy to flip.
- **[Image payload on first paint goes from ~6 to ~25 portraits] → Mitigation:** All portraits are already shipped as small WebP/JPGs in `pics/`, and `<img loading="lazy">` is already on `avatarHtml`. Above-the-fold lazy loading is effectively eager on most browsers, so expect ~25 image fetches; payload is well under 500KB. Acceptable.
- **[Mixed-party algorithm could still produce a "feels clustered" layout for some shuffles] → Mitigation:** The 50-iteration cap ensures determinism. If layout still feels off, future work can switch to a seeded balanced shuffle (e.g. round-robin by party).
- **[Removing the "share like a Wordle score" pitch from the hero loses a hook] → Mitigation:** The share UX still lives on the results screen; the hero is not the right place to advertise it. Users who finish voting see it immediately afterward.
- **[Border ring with `box-shadow` won't show under a CSS overflow:hidden ancestor] → Mitigation:** `.hero .roster .avatar` has no `overflow:hidden` ancestor in the start-screen hierarchy. Verified during apply.
