# civic-explainer Specification

## Purpose
TBD - created by archiving change tier-list-view. Update Purpose after archive.
## Requirements
### Requirement: Civic-explainer panel exists with two anchored sections
The system SHALL provide a reusable "How does this work?" panel with DOM id `civic-explainer` containing exactly two sections, each addressable by anchor:
- `#how-elo` — explains in plain English how pairwise votes feed an Elo / Glicko-2 rating, how the rating drives the candidate's tier position, and how the tier list is shareable;
- `#why-rcv` — explains in plain English what ranked-choice voting is and how it tends to elect what most people want rather than just satisfying 50%+1 of voters.

The panel MUST be mounted in the DOM but hidden by default. Both sections SHALL be present at all times so that direct anchor links work without further loading.

#### Scenario: Panel is present but hidden by default
- **WHEN** the page loads
- **THEN** the `#civic-explainer` element exists in the DOM
- **AND** it has the `hidden` attribute set or is otherwise visually inactive
- **AND** both `#how-elo` and `#why-rcv` sections are present inside it

#### Scenario: Anchored section can be deep-linked
- **WHEN** the panel is opened with `openExplainer('why-rcv')`
- **THEN** the panel becomes visible
- **AND** scrolls so that the `#why-rcv` section is at the top of the panel viewport

### Requirement: Open/close API reusable by any host surface
The system SHALL expose `openExplainer(section?: 'how-elo' | 'why-rcv')` and `closeExplainer()` functions reachable by any module in `app.js`. Calling `openExplainer()` with no argument SHALL open the panel scrolled to the top (i.e., starting with the `#how-elo` section). The panel SHALL be dismissible by an explicit close button, by the `Escape` key, and by clicking the backdrop.

#### Scenario: openExplainer with no argument opens at the top
- **WHEN** any caller invokes `openExplainer()`
- **THEN** the panel becomes visible
- **AND** the scroll position is at the top
- **AND** the `#how-elo` section is at the top of the panel viewport

#### Scenario: Escape closes the panel
- **WHEN** the panel is open and the user presses the `Escape` key
- **THEN** the panel becomes hidden
- **AND** focus returns to the element that originally opened it

#### Scenario: Backdrop click closes the panel
- **WHEN** the panel is open and the user clicks the dimmed area outside the panel content
- **THEN** the panel becomes hidden

### Requirement: Trigger sites on tier-list and results screens
The system SHALL render explainer triggers on at least two host surfaces in v1:
- A "How is this calculated?" link in the tier-list header (both inline and at `#/tiers`) that calls `openExplainer('how-elo')`.
- A small `(i)` icon next to the "Your top 5" heading on the results screen that calls `openExplainer('why-rcv')`.

#### Scenario: Tier-list trigger opens the Elo section
- **WHEN** the user clicks "How is this calculated?" in the tier-list header
- **THEN** the explainer panel opens
- **AND** the `#how-elo` section is at the top of the panel viewport

#### Scenario: Results-screen trigger opens the RCV section
- **WHEN** the user clicks the `(i)` icon next to "Your top 5" on the results screen
- **THEN** the explainer panel opens
- **AND** the `#why-rcv` section is at the top of the panel viewport

### Requirement: "Share with a friend" link in the Elo section
The `#how-elo` section SHALL contain a "Share this with a friend" link that copies the canonical absolute URL `https://<host>/#/tiers` to the clipboard and shows a transient confirmation toast.

#### Scenario: Share link copies the canonical /tiers URL
- **WHEN** the user clicks "Share this with a friend" inside the `#how-elo` section
- **THEN** the clipboard contains `https://<host>/#/tiers` where `<host>` is the current origin's host
- **AND** a transient toast reads "Link copied"
- **AND** the toast auto-dismisses after 3 seconds

### Requirement: Discoverability hint dismisses after first use
The system SHALL apply a subtle visual hint (e.g., a pulse animation) to the "How is this calculated?" trigger until the user opens the explainer for the first time. After the first open, the hint SHALL be suppressed for all future sessions via the `localStorage` key `civicExplainer.dismissedTip` set to `"1"`.

#### Scenario: Hint shows on first visit
- **WHEN** a visitor with no prior `civicExplainer.dismissedTip` value opens the tier-list view
- **THEN** the "How is this calculated?" trigger has the pulse hint applied

#### Scenario: Hint suppressed after first open
- **WHEN** the user opens the explainer for the first time
- **THEN** `localStorage['civicExplainer.dismissedTip']` is set to `"1"`
- **AND** on any subsequent page load, the trigger is rendered without the hint

### Requirement: Copy is non-partisan and reviewable as a single source
All explainer copy MUST be authored as string constants in a single location in `app.js` (or a sibling module) so that copy edits do not require touching markup. The "Why ranked choice?" framing SHALL be written so that it does not advocate for any party or candidate.

#### Scenario: Copy lives in one place
- **WHEN** an author needs to revise the Elo or RCV explanation
- **THEN** all editable copy is found in a single named constant in the source

#### Scenario: Copy is non-partisan
- **WHEN** the panel renders
- **THEN** neither section mentions a specific candidate, party, or political event
- **AND** the RCV framing describes the mechanism in neutral terms ("electing the option most people support")

