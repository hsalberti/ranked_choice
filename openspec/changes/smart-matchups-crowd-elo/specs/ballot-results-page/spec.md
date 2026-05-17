## ADDED Requirements

### Requirement: Results screen is a focused ballot artifact
The results screen SHALL be visually and structurally focused on the user's top-5 ballot. The top-5 list, the Wordle-shape emoji grid, a copy-to-clipboard button, an X (Twitter) post button, a "See global stats →" CTA, and the tier-progression CTA are the only headline elements above the fold on a mobile viewport (≤ 414px width).

#### Scenario: Above-the-fold inventory on mobile
- **WHEN** the user reaches the results screen on a 390×844 viewport
- **THEN** the visible region contains: the top-5 list, the emoji grid, the copy button, the X-post button, the "See global stats →" CTA, and (if applicable) the "Keep voting" CTA
- **AND** does not contain a full ranking, country leaderboard, or you-vs-country comparison

### Requirement: Copy and X-post share buttons
The results screen SHALL provide a "Copy ballot" button that copies the existing Wordle-shape share text (headline, emoji grid, numbered top-5 lines, share URL) to the clipboard, and a separate "Post to X" button that opens the X (Twitter) compose URL pre-filled with the same text. Both buttons SHALL be keyboard-accessible. If `navigator.share` is available, a native share button SHALL also appear.

#### Scenario: Copy puts the share text on the clipboard
- **WHEN** the user clicks "Copy ballot"
- **THEN** the clipboard contains the full share text
- **AND** a toast confirms "Copied — paste it anywhere"

#### Scenario: X-post opens compose URL
- **WHEN** the user clicks "Post to X"
- **THEN** a new tab opens at `https://twitter.com/intent/tweet?text=...` with the share text URL-encoded
- **AND** the share URL is included exactly once

#### Scenario: Native share available
- **WHEN** the user is on a device where `navigator.share` is defined
- **THEN** the native share button is visible in addition to copy and X-post

### Requirement: Stats CTA navigates to stats screen
The results screen SHALL include a "See global stats →" CTA that activates the stats screen described in capability `stats-screen`. The CTA SHALL be visually distinct from the share buttons (different visual weight) so users perceive it as exploration, not sharing.

#### Scenario: Stats CTA activates stats screen
- **WHEN** the user clicks "See global stats →"
- **THEN** the stats screen becomes active
- **AND** the results screen state is preserved for return navigation

### Requirement: Tier-progression CTA
The results screen SHALL surface a "Keep voting · 12 more ↓" CTA when Tier 2 has not been completed, and a "Go deeper · 13 more ↓" CTA when Tier 2 has been completed but Tier 3 has not. Both CTAs SHALL be visually subordinate to the share buttons and stats CTA. The label MUST reflect the actual remaining count from the active roster.

#### Scenario: Tier-2 CTA after Tier 1
- **WHEN** the user reaches the results screen after completing Tier 1
- **THEN** a "Keep voting · 12 more ↓" CTA is visible

#### Scenario: Tier-3 CTA after Tier 2
- **WHEN** the user reaches the results screen after completing Tier 2
- **THEN** a "Go deeper · 13 more ↓" CTA is visible

#### Scenario: No CTA after Tier 3
- **WHEN** the user reaches the results screen after completing Tier 3
- **THEN** no tier-progression CTA is visible

### Requirement: Off-page elements moved to stats screen
The results screen SHALL NOT render the country leaderboard, the you-vs-country comparison panel, or the full ranking (ranks 6+) inline. These elements move to the stats screen. The "Show full ranking ↓" toggle on the results screen SHALL be removed.

#### Scenario: No country leaderboard on results
- **WHEN** the results screen renders
- **THEN** no `#country-leaderboard` element is visible
- **AND** no `#country-comparison` element is visible
- **AND** no `#full-ranking` element is visible

### Requirement: Share URL prefers server-side ballot id
The share URL on the results screen SHALL prefer the form `?b=<ballot_id>` (server-side ballot id from `POST /api/ballot`). If the ballot has not yet been persisted server-side (e.g., API unreachable), the URL SHALL fall back to the legacy inline form `?b=ids[&x=ids]`. Friends opening either URL form SHALL see a friend-ballot intro on the start screen.

#### Scenario: Server-side id when available
- **WHEN** the ballot has been persisted to `/api/ballot` and returned an id
- **THEN** the share URL is `<origin>/?b=<id>`
- **AND** no `x=` query parameter is present

#### Scenario: Legacy inline fallback
- **WHEN** the ballot has not been persisted (API unreachable)
- **THEN** the share URL is `<origin>/?b=id1,id2,id3,id4,id5[&x=...]`
