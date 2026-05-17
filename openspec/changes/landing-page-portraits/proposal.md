## Why

The current start screen ("Who should run in 2028?") shows only six small, anonymous-looking circular avatars and a one-line pitch. It under-sells the product: visitors can't see the roster they're about to vote on, can't tell it's a Democrats-vs-Republicans field at a glance, and don't know that the app also yields per-candidate ELO and a personal-preference read-out. The hook becomes more concrete — and the field more legible — if we show all 25 Tier-1 portraits with party-coded borders and describe the three things the app actually does.

## What Changes

- **Show all 25 Tier-1 portraits on the start screen.** Replace today's 6-avatar shuffled preview (`renderStartPreview`) with a single grid of every Tier-1 candidate, rendered via the existing `avatarHtml` helper.
- **Party-coded borders, intermixed order.** Each portrait gets a visible border in the candidate's party color (red for `party-R`, blue for `party-D`, neutral for `party-I`). Order is shuffled but constrained so that no more than two same-party portraits appear consecutively — the grid should read as visibly mixed, not party-clustered.
- **Larger portraits.** Bump the start-screen avatar size from today's `sm` (44px desktop / 56px mobile breakpoint) up one step so the grid reads as a deliberate roster, not a decorative stack.
- **Sharper copy.** Replace the current subhead ("Tap through 25 head-to-head matchups. We'll build your ranked-choice top 5 and you can share it like a Wordle score.") with three-beat product copy: *"Rank them, see each candidate's ELO. Understand your preferences."* Keep the existing `start-meta` row ("· 25 candidates · ~2 minutes · no signup") and the "Start voting →" CTA.
- **No behavior change elsewhere.** The voting flow, results screen, stats screen, and share flow are untouched. This is a presentation-only change to `#screen-start`.

## Capabilities

### New Capabilities
- `landing-page`: The start-screen presentation contract — the roster preview grid, the party-border treatment, the headline + descriptive subhead, and the `start-meta` + CTA wiring. Owns what the user sees before they tap "Start voting".

### Modified Capabilities
*(No existing specs to modify — `openspec/specs/` is empty.)*

## Impact

- **Code (frontend):** `app.js` (`renderStartPreview` rewritten to render all Tier-1 candidates with a party-balanced shuffle; size flag updated). `styles.css` (new `.hero .roster` grid rules, larger avatar size on the start screen, explicit party-border colors; today's `.hero .preview .avatar` rules become the new grid rules or get superseded). `index.html` (`#start-preview` container kept; subhead copy updated; CSS class may be renamed to `roster` for clarity).
- **No backend changes.** No new API endpoints, no D1 migrations, no Worker updates.
- **Specs / docs:** New `openspec/changes/landing-page-portraits/specs/landing-page/spec.md`. No project-level `specs/` updates.
- **Performance:** Goes from 6 portrait `<img>` tags to 25 on first paint. All are `loading="lazy"` already; the start screen is above-the-fold so most will load eagerly anyway. Acceptable — total payload is ~25 small WebP/JPGs already shipped in `pics/`.
- **Risk:** Low. Avatars are already styled with party-tinted backgrounds; this change formalizes party color as a visible border and bumps size. Reversible.
