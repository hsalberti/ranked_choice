## ADDED Requirements

### Requirement: Roster preview shows 25 candidate portraits

The start screen SHALL render a roster preview containing exactly 25 candidate portraits, drawn from the candidate pool in `candidates.js`. The portraits SHALL be sourced via the existing `avatarHtml(c, size)` helper so that real candidate photos (when present in `window.CANDIDATE_PHOTOS`) are used and initials are used as a fallback.

#### Scenario: Start screen renders on a fresh load

- **WHEN** a visitor lands on the start screen with no prior session state
- **THEN** the roster preview container under the hero contains exactly 25 portrait elements
- **AND** each portrait shows either the candidate's photo or their initials per the existing `avatarHtml` fallback rules

#### Scenario: All 25 portraits are distinct candidates

- **WHEN** the roster preview is rendered
- **THEN** no two portraits in the grid correspond to the same candidate id

### Requirement: Portraits are bordered by party color

Each portrait in the roster preview SHALL display a visible ring in the candidate's party color. The ring color SHALL map party-R to the `--rep` (red) color token, party-D to the `--dem` (blue) color token, and party-I to the `--ind` (neutral) color token. The ring SHALL be rendered such that it does not displace or resize the portrait content (e.g. via `box-shadow` rather than a layout-affecting `border`).

#### Scenario: Republican candidate has a red ring

- **WHEN** a portrait represents a candidate with `party: 'R'`
- **THEN** its visible ring color resolves to the `--rep` color token

#### Scenario: Democratic candidate has a blue ring

- **WHEN** a portrait represents a candidate with `party: 'D'`
- **THEN** its visible ring color resolves to the `--dem` color token

#### Scenario: Independent candidate has a neutral ring

- **WHEN** a portrait represents a candidate with `party: 'I'`
- **THEN** its visible ring color resolves to the `--ind` color token

### Requirement: Portrait order is party-mixed

The 25 portraits SHALL be ordered so that no more than two portraits of the same party appear in consecutive positions in the grid's render order. Order SHALL be shuffled per page load (i.e. not deterministic across loads).

#### Scenario: No run of three same-party portraits

- **WHEN** the roster preview is rendered
- **THEN** for every triple of consecutive portraits in render order, at least one differs in party from the other two

#### Scenario: Order varies across loads

- **WHEN** a visitor reloads the start screen
- **THEN** the order of portraits in the roster preview is not guaranteed to match the previous load's order

### Requirement: Portraits are larger than the prior preview

The roster preview portraits SHALL be visibly larger than the prior 6-avatar preview's `sm` size (38px desktop / 56px mobile breakpoint per `styles.css`). They SHALL be sized in a range that allows 25 portraits to fit on the start screen above the call-to-action on a standard mobile viewport (e.g. 390×844) without forcing the CTA below the fold on desktop (≥ 1024px width).

#### Scenario: Portrait size exceeds prior preview

- **WHEN** the roster preview is rendered on any viewport
- **THEN** each portrait's rendered width is strictly greater than the previous `.hero .preview .avatar` width at the same viewport

#### Scenario: CTA remains visible on a mobile viewport

- **WHEN** the start screen is rendered on a 390×844 viewport with default browser chrome
- **THEN** the "Start voting →" CTA is reachable within one short scroll (≤ 1 viewport-height of scroll) from the top of the page

### Requirement: Hero subhead describes the three product surfaces

The start screen hero SHALL display the subhead text *"Rank them, see each candidate's ELO. Understand your preferences."* immediately below the H1 and above the roster preview. The H1, `.start-meta` row, and "Start voting →" CTA SHALL remain unchanged.

#### Scenario: Subhead text is present

- **WHEN** the start screen is rendered
- **THEN** the hero contains a paragraph whose text is exactly "Rank them, see each candidate's ELO. Understand your preferences."

#### Scenario: Existing hero elements are preserved

- **WHEN** the start screen is rendered
- **THEN** the H1 ("Who should run in 2028?") is present
- **AND** the `.start-meta` row with "25 candidates", "~2 minutes", "no signup" is present
- **AND** the "Start voting →" CTA is present and triggers the same handler as before

### Requirement: Roster preview portraits are non-interactive

The 25 roster-preview portraits SHALL be presentational only: they SHALL NOT be focusable, SHALL NOT respond to clicks, and SHALL NOT open the detail sheet. They SHALL be marked `aria-hidden="true"` (consistent with the existing `avatarHtml` output).

#### Scenario: Portraits do not respond to clicks

- **WHEN** a user clicks any roster-preview portrait
- **THEN** no navigation, modal, or detail sheet is triggered
- **AND** focus does not move to the portrait

#### Scenario: Portraits are excluded from the accessibility tree

- **WHEN** a screen reader traverses the start screen
- **THEN** the roster-preview portraits are not announced
