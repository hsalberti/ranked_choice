## ADDED Requirements

### Requirement: Stats screen exists and is reachable only from results
The system SHALL render a new top-level view with DOM id `screen-stats`, reachable exclusively via a "See global stats →" CTA on the results screen. The stats screen MUST NOT be reachable from the start screen, the vote screen, or any persistent footer link in v1.

#### Scenario: Stats screen mounted but hidden by default
- **WHEN** the page loads
- **THEN** the `#screen-stats` element exists in the DOM
- **AND** does not have the `active` class
- **AND** is not visible

#### Scenario: Reachable from results only
- **WHEN** the user reaches the results screen and clicks the "See global stats →" button
- **THEN** the stats screen becomes active
- **AND** the results screen retains its state so a back action returns the user to their ballot intact

#### Scenario: No start-screen entrypoint
- **WHEN** the user is on the start screen
- **THEN** no button or link on that screen navigates to the stats screen

### Requirement: Country and party filters
The stats screen SHALL provide two filter controls: a country chip-row defaulting to the visitor's country (from `/api/health`) and including a "Global" option, and a party chip-row with options `All`, `R`, `D`, `I`. Changing either filter SHALL re-query `/api/elo` and re-render the candidate list. When the visitor's country has no data, the country chip-row SHALL fall back to "Global" selected.

#### Scenario: Default filter on first open
- **WHEN** the user opens the stats screen from a Brazilian IP
- **THEN** the country filter is set to `BR`
- **AND** the party filter is set to `All`
- **AND** the list shows candidates ordered by ELO for `BR`

#### Scenario: Party filter narrows the list
- **WHEN** the user clicks the `R` party chip
- **THEN** the list re-renders showing only candidates with `party === "R"`
- **AND** a new request to `/api/elo?country=BR&party=R` is made

#### Scenario: Global fallback for low-data countries
- **WHEN** the visitor's country has fewer than 5 candidates above the min-N threshold
- **THEN** the country filter defaults to `Global` on first open and shows a brief note "Not enough data in <country> yet — showing Global"

### Requirement: Candidate list and detail-sheet wiring
Each row in the stats list SHALL display avatar, name, party chip, current ELO rounded to the nearest integer, and `n_ballots` for the currently-selected scope. Tapping a row SHALL open the existing candidate detail sheet (`backHtml(c)`), preserving stats-screen state behind it.

#### Scenario: Row content
- **WHEN** the list renders for the default scope
- **THEN** each row contains an avatar, the candidate's name, a party chip, an integer ELO, and a "N ballots" count

#### Scenario: Row opens detail sheet
- **WHEN** the user taps a row
- **THEN** the existing detail sheet opens with that candidate's `backHtml`
- **AND** closing the sheet returns to the stats screen with filters unchanged

### Requirement: Back navigation preserves results state
The stats screen SHALL include a back affordance ("← Back to your ballot") that returns to the results screen. The user's ballot, share text, and CTAs MUST be intact after returning.

#### Scenario: Back returns to results with state intact
- **WHEN** the user is on the stats screen and clicks "← Back to your ballot"
- **THEN** the results screen becomes active
- **AND** the user's top-5 is unchanged
- **AND** the "Keep voting" CTA visibility is unchanged

### Requirement: Empty and error states
The system SHALL render an empty state when `/api/elo` returns an empty array (e.g., the selected country has no qualifying candidates) and SHALL render an error state when the request fails. Neither state SHALL crash the screen; both SHALL keep the filters interactive.

#### Scenario: Empty state for a low-data scope
- **WHEN** `/api/elo` returns an empty array
- **THEN** the screen displays a message "No data yet for this scope" and keeps the filter chips interactive

#### Scenario: Error state on fetch failure
- **WHEN** `/api/elo` returns HTTP 500 or the fetch rejects
- **THEN** the screen displays "Couldn't load — try again" with a retry button
- **AND** filter chips remain interactive
