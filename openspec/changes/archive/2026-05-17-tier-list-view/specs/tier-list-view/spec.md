## ADDED Requirements

### Requirement: Tier-list view exists with two entry points sharing one component
The system SHALL render a tier-list visualization of candidates grouped into named tier rows (S/A/B/C, plus D and F when expanded). The rendering SHALL be exposed via two entry points that share a single render function: (a) inline within `#screen-results`, mounted lazily on scroll into view, and (b) a dedicated screen `#screen-tiers` reachable via hash route `#/tiers`.

#### Scenario: Inline section appears below results CTAs
- **WHEN** the user reaches the results screen and scrolls past the share-button region
- **THEN** the tier-list section becomes visible below the existing CTAs
- **AND** is rendered into the same `#screen-results` container without navigating away

#### Scenario: Lazy mount on first scroll into view
- **WHEN** the results screen first becomes active
- **THEN** the tier-list section is present in the DOM but unrendered
- **AND** the `renderTierList` function is invoked only after the section enters the viewport
- **AND** if the user shares and leaves without scrolling, no render cost is paid

#### Scenario: Dedicated /tiers route mounts the same component
- **WHEN** the user navigates to `#/tiers` (direct link, refresh, or click)
- **THEN** the `#screen-tiers` screen becomes active
- **AND** the same `renderTierList` function is invoked into `#screen-tiers`'s body
- **AND** the screen has its own header with logo, back-to-vote link, and "How is this calculated?" link

#### Scenario: Browser back from /tiers returns to prior screen
- **WHEN** the user opens `#/tiers` from the results screen and then presses browser back
- **THEN** the results screen is shown
- **AND** the user's ballot, share buttons, and tier-progression CTAs are intact

### Requirement: Fixed-count tier cut by roster size
The system SHALL bucket candidates into tiers by their rank position using fixed counts that depend on the selected roster size. The cut function MUST be pure and depend only on the ranked candidate list and the size value.

| Size | S | A | B | C | D  | F  |
|------|---|---|---|---|----|----|
| 15   | 2 | 3 | 4 | 6 | —  | —  |
| 25   | 2 | 3 | 5 | 7 | 8  | —  |
| 40   | 2 | 3 | 5 | 7 | 8  | 15 |

Bucket sums MUST equal the size value exactly. Two viewers selecting the same size and source MUST see identical groupings.

#### Scenario: 15-roster default cut
- **WHEN** the tier list renders with size = 15
- **THEN** the S row contains the top 2 by current Elo
- **AND** the A row contains the next 3
- **AND** the B row contains the next 4
- **AND** the C row contains the next 6
- **AND** D and F rows are not rendered

#### Scenario: 25-roster cut adds D
- **WHEN** the tier list renders with size = 25
- **THEN** rows S/A/B/C have counts 2/3/5/7 respectively
- **AND** the D row contains the next 8
- **AND** the F row is not rendered

#### Scenario: 40-roster cut adds F
- **WHEN** the tier list renders with size = 40
- **THEN** rows S/A/B/C/D have counts 2/3/5/7/8 respectively
- **AND** the F row contains the next 15

#### Scenario: Two viewers see the same tier list at the same size and source
- **WHEN** two different visitors view the tier list with size = 15 and source = Global at the same moment
- **THEN** the candidates in each tier are identical between the two views

### Requirement: Roster-size toggle persists across sessions
The system SHALL render three roster-size pill buttons in the tier-list header (top-right): `15`, `25`, `40`. The selected value SHALL be persisted in `localStorage` under the key `tierList.rosterSize` and SHALL be restored on next mount. The default on first visit MUST be `15`.

#### Scenario: Default on first visit
- **WHEN** a visitor with no prior preference opens the tier list
- **THEN** the size pill `15` is selected
- **AND** the tier list renders with the 15-roster cut

#### Scenario: Selection persists across page reloads
- **WHEN** the visitor selects size `25` and reloads the page
- **THEN** the size pill `25` is selected on the next load
- **AND** the tier list renders with the 25-roster cut

#### Scenario: Selection updates layout immediately
- **WHEN** the visitor selects a different size pill
- **THEN** the tier list re-renders within the same animation frame
- **AND** no network request is fired (cached `/api/elo` data is reused)

### Requirement: Source toggle (Global vs Mine) with vote-count enablement floor
The system SHALL render two source pill buttons next to the roster-size toggle: `Global` (default) and `Mine`. `Global` reads from the cached `GET /api/elo?country=GLOBAL&limit=50` response; `Mine` reads from the in-memory Glicko ratings maintained by the vote engine. `Mine` MUST be disabled with `aria-disabled="true"` and labeled "Vote first" until the user has recorded at least 5 votes in the current session. The selection SHALL persist in `localStorage` under the key `tierList.source` and SHALL be restored on next mount.

#### Scenario: Default on first visit is Global
- **WHEN** a fresh visitor opens the tier list
- **THEN** the source pill `Global` is selected
- **AND** Mine is rendered as disabled with the label "Vote first"

#### Scenario: Mine enables after the 5th vote
- **WHEN** the user has cast 5 or more pairwise votes in the current session
- **THEN** the Mine pill becomes interactive
- **AND** the "Vote first" label is removed

#### Scenario: Tapping disabled Mine shows an explanatory toast
- **WHEN** the user taps Mine before reaching 5 votes
- **THEN** a transient toast reads "Vote at least 5 times to see your personal tier list"
- **AND** the toast auto-dismisses after 3 seconds
- **AND** Global remains selected

#### Scenario: Switching to Mine re-renders from in-memory ratings
- **WHEN** the user (with ≥5 votes) selects Mine
- **THEN** the tier list re-renders using the in-memory `ratings[id]` Glicko ratings
- **AND** no network request is fired

#### Scenario: Mine resets to disabled on page reload
- **WHEN** the user reloads the page after voting
- **THEN** the in-memory rating state is reset
- **AND** Mine is disabled and labeled "Vote first" until 5 new votes accrue

### Requirement: Candidate avatar opens the existing detail sheet on click
The system SHALL respond to taps or clicks on any candidate avatar within a tier row by opening the existing `openDetailSheet(cid)` overlay for that candidate. The tier-list view MUST remain mounted behind the sheet and resume in its prior state on sheet close.

#### Scenario: Tap opens detail sheet
- **WHEN** the user taps a candidate avatar in any tier row
- **THEN** the existing detail sheet opens with that candidate's name, party, country, current Elo, and `n_ballots`

#### Scenario: Closing the sheet returns to the tier list unchanged
- **WHEN** the user closes the detail sheet
- **THEN** the tier-list view is the active surface
- **AND** the roster-size and source selections are unchanged
- **AND** the scroll position is preserved

### Requirement: PNG export of the current tier list
The system SHALL provide a "Save as image" button in the tier-list header that exports the currently-rendered tier list as a 1200×630 PNG file. The export MUST be performed client-side via an offscreen `<canvas>`, MUST NOT require a Worker round-trip, and MUST work without any added runtime dependencies. The downloaded filename SHALL follow the pattern `2028ballot-tier-{global|mine}-{15|25|40}.png`.

#### Scenario: Export button generates a PNG
- **WHEN** the user clicks "Save as image"
- **THEN** the browser downloads a PNG file
- **AND** the filename matches the pattern `2028ballot-tier-<source>-<size>.png`
- **AND** the file decodes as a valid PNG of dimensions 1200×630

#### Scenario: Export reflects current toggle state
- **WHEN** the user has selected size = 25 and source = Mine, then clicks Save as image
- **THEN** the downloaded PNG renders the 25-roster, personal-Elo tier list
- **AND** the filename is `2028ballot-tier-mine-25.png`

#### Scenario: Export does not require Worker network access
- **WHEN** the user clicks Save as image
- **THEN** no request to `/api/og` or any other Worker endpoint is fired
- **AND** the PNG is generated entirely from cached / in-memory data

### Requirement: Cached `/api/elo` lookup for Global source
The system SHALL fetch `GET /api/elo?country=GLOBAL&limit=50` once on the first tier-list mount of a session and cache the response in a module-scoped variable for 5 minutes. Subsequent renders, toggle changes, and re-mounts within the cache window SHALL reuse the cached response. After the cache expires, the next tier-list mount SHALL re-fetch.

#### Scenario: First mount fetches and caches
- **WHEN** the user first reaches the inline tier list or `#/tiers` in a session
- **THEN** one `GET /api/elo?country=GLOBAL&limit=50` request is fired
- **AND** the response is held in memory for 5 minutes

#### Scenario: Toggle within the cache window does not refetch
- **WHEN** the user toggles roster size or source within 5 minutes of the initial fetch
- **THEN** no additional `/api/elo` request is fired

#### Scenario: Refetch after cache expiry
- **WHEN** the user re-opens the tier list more than 5 minutes after the prior fetch
- **THEN** a new `GET /api/elo?country=GLOBAL&limit=50` request is fired

### Requirement: Hash-routing for the dedicated `/tiers` screen
The system SHALL register a `hashchange` listener that maps `#/tiers` to `show('tiers')`. Existing hash-less navigation MUST continue to work unchanged. Direct loads of `https://<host>/#/tiers` MUST land on the tier-list screen without first flashing the start screen.

#### Scenario: Direct deep link
- **WHEN** the user opens `https://2028ballot.almaintel.com/#/tiers` in a fresh tab
- **THEN** the tier-list screen is the active surface on load
- **AND** the start screen is not visibly rendered before the transition

#### Scenario: Hash change navigates without reload
- **WHEN** the URL hash changes to `#/tiers` while the app is loaded
- **THEN** the tier-list screen becomes active
- **AND** no full page reload occurs

#### Scenario: Existing button-driven navigation still works
- **WHEN** the user clicks the "See global stats →" button on the results screen
- **THEN** the stats screen becomes active as before (this change does not affect that path)

### Requirement: Mobile-first layout with horizontal scroll-snap on tier rows
On viewports narrower than 600px CSS pixels, the system SHALL render each tier row as a horizontally scroll-snapping container so a row that overflows the viewport remains usable without breaking the tier-grid metaphor. On viewports 600px and wider, rows SHALL wrap to multi-line as needed.

#### Scenario: Mobile viewport scroll-snap
- **WHEN** the user opens the tier list on a 390px-wide viewport with size = 40 (F tier contains 15 candidates)
- **THEN** the F-tier row can be scrolled horizontally
- **AND** each candidate avatar snaps to a scroll position when scrolled

#### Scenario: Desktop viewport wraps
- **WHEN** the user opens the tier list on a 1280px-wide viewport with size = 40
- **THEN** each tier row uses the available width
- **AND** rows that exceed the width wrap to a second line within the same tier
