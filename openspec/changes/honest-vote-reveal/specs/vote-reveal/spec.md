# Capability: vote-reveal

In-card vote reveal: replaces the floating stat overlay with a party-tinted winner card carrying ELO, rank, and pair-win statistics drawn from real backend data. Owns the visual reveal, the auto-advance timer, the WebAudio sound layer, and the mute toggle.

## ADDED Requirements

### Requirement: Floating stat overlay removed

The frontend SHALL NOT render a floating `#stat-overlay` element. The element, its child structure, and the associated `showStatOverlay`, `overlayTimer`, `overlayContext`, `fetchPairStats`, `loadLocalVotes`, `saveLocalVote`, `undoLocalVote`, `STORAGE_LOCAL_VOTES` symbols SHALL be deleted from `app.js`, `index.html`, and `styles.css`.

#### Scenario: No overlay element in DOM
- **WHEN** the page loads
- **THEN** `document.getElementById('stat-overlay')` returns `null`
- **AND** the document contains no element with class `stat-seg`, `stat-pct`, or `stat-headline`

#### Scenario: No seeded pair statistics function
- **WHEN** any code path queries pair statistics
- **THEN** the only function invoked is the one that reaches the backend (`fetchStatsForReveal` calling `GET /api/stats`)
- **AND** no deterministic-hash fallback or localStorage tally is consulted

### Requirement: Party-color tint on winner card, dim on loser card

When the user clicks a candidate card, the frontend SHALL apply a `.winner` class and a `.party-<P>` class to the chosen card (where `<P>` is `D`, `R`, or `I`), tinting its background, border, and text panel in the party color. The portrait image (`.avatar img`) SHALL remain visually unaffected by the party tint — only the surrounding chrome changes. The unchosen card SHALL receive a `.loser` class that reduces opacity to approximately 50% with no party tint.

#### Scenario: Democrat candidate picked
- **WHEN** the user clicks a card whose candidate has `party: "D"`
- **THEN** that card's chrome (background, border, info panel) is tinted using the `--party-d` CSS variable
- **AND** the candidate's portrait image renders at full saturation
- **AND** the opposing card has opacity ≈ 0.5

#### Scenario: Republican candidate picked
- **WHEN** the user clicks a card whose candidate has `party: "R"`
- **THEN** that card's chrome is tinted using the `--party-r` CSS variable
- **AND** the portrait image renders at full saturation

#### Scenario: Independent candidate picked
- **WHEN** the user clicks a card whose candidate has `party: "I"`
- **THEN** that card receives a `.party-I` tint (or a neutral accent if `--party-i` is undefined)
- **AND** the dim-loser behavior is unchanged

### Requirement: ELO and rank shown on the winner card

When real stats are available from `GET /api/stats`, the winner card's reveal panel SHALL display the line `${elo} ELO · Rank #${rank}` where `elo` is rounded to the nearest integer and `rank` is the candidate's global rank. If `rank === null` (because `n_ballots < 10`), the suffix SHALL be `· UNRANKED` instead of `· Rank #${rank}`. The loser card's reveal panel SHALL render the same line under its `.loser` dim treatment, so the comparison is visible.

#### Scenario: Both candidates above floor
- **WHEN** the reveal renders for a vote where both candidates have `n_ballots >= 10`
- **THEN** both cards show their `ELO · Rank #N` lines
- **AND** the winner card's line is in party-tinted chrome and the loser card's is dimmed

#### Scenario: Winner below floor
- **WHEN** the reveal renders for a vote where the winner has `n_ballots < 10`
- **THEN** the winner card's first line shows `${elo} ELO · UNRANKED` (or just `UNRANKED` if elo is null)
- **AND** the visual treatment (party tint, dim loser) is unchanged

### Requirement: Pair-win statistics shown on the winner card

When `pair_total >= 10` for the active scope (see capability `crowd-elo`), the winner card's reveal panel SHALL display a second line of the form `Won against ${loserLastName} ${pct}% of ${formattedTotal} votes` where `pct` is the percentage of votes that favored the winner (rounded to nearest integer) and `formattedTotal` uses thousands separators. If the response's `scope` is a country code rather than `GLOBAL`, the line SHALL append ` in ${country}`. If `pair_total < 10`, the line SHALL instead read `Early matchup — ${pair_total} votes so far`.

#### Scenario: Established pair, global scope
- **WHEN** the reveal renders for a pair with `total.global >= 10` and `scope === "GLOBAL"`
- **THEN** the second line reads e.g. `Won against Newsom 29% of 4,329 votes`
- **AND** the percentage matches `winner_global_votes / (winner_global_votes + loser_global_votes)` rounded

#### Scenario: Country scope active
- **WHEN** the reveal renders for a country whose total volume crossed the activation threshold (see capability `crowd-elo`)
- **THEN** the second line ends with ` in ${countryCode}`
- **AND** the counts shown are from the country-scope counts in the response

#### Scenario: Early matchup
- **WHEN** the reveal renders for a pair with fewer than 10 votes in the active scope
- **THEN** the second line reads `Early matchup — ${total} votes so far`
- **AND** no percentage is shown

### Requirement: Empty state on API failure

If `GET /api/stats` fails, times out, or `API_REACHABLE === false`, the reveal SHALL still render the party tint on the winner card and the dim on the loser card, but SHALL NOT render either data line. No fabricated, seeded, or estimated numbers SHALL be displayed.

#### Scenario: Network offline
- **WHEN** the user clicks a card while offline
- **THEN** the winner card receives `.winner.party-<P>` classes and the loser card receives `.loser`
- **AND** the reveal panels remain empty
- **AND** no `Estimate based on...` or hash-derived fallback text appears
- **AND** the 1.5s advance timer still fires

#### Scenario: API returns 500
- **WHEN** `GET /api/stats` returns an HTTP error
- **THEN** the visual reveal is unchanged but data lines are not rendered

### Requirement: 1.5-second auto-advance, tap-to-advance

After the reveal renders, the frontend SHALL automatically advance to the next matchup after 1500 milliseconds. The user MAY tap anywhere on either card during the reveal window to advance immediately. Advancement clears the `.winner`, `.loser`, `.party-D`, `.party-R`, `.party-I` classes from both cards and empties the reveal panels before the next pair is rendered.

#### Scenario: Auto-advance
- **WHEN** 1500ms pass after a vote is cast
- **THEN** the next matchup renders on the same `#card-a` / `#card-b` DOM elements
- **AND** both cards are reset to their neutral pre-vote state

#### Scenario: Tap to advance
- **WHEN** the user taps any card while the reveal is showing
- **THEN** the pending advance timer is cancelled
- **AND** the next matchup renders immediately

### Requirement: Pick sound and resolved chime

On every card click that records a vote, the frontend SHALL play a short pick click cue (≈30ms, triangle wave ~800 Hz, exponential gain decay). When the reveal completes its render (after `/api/stats` response or the empty-state fallback resolves, whichever first), the frontend SHALL play a resolved chime (two-note sine arpeggio E5 → A5, ~240ms total, low peak gain). Sounds SHALL be synthesized via the WebAudio API; no audio assets are loaded over the network.

#### Scenario: Pick click on every vote
- **WHEN** the user clicks a candidate card and the click is accepted as a vote
- **THEN** a 30ms click sound plays
- **AND** the sound plays even if the network request fails

#### Scenario: Resolved chime after reveal
- **WHEN** the reveal panels are populated (or determined to be empty due to API failure)
- **THEN** a two-note chime plays at low volume
- **AND** the chime is suppressed if the user advanced via tap before the reveal settled

#### Scenario: WebAudio context initialization on iOS
- **WHEN** the user makes their first interaction on iOS Safari
- **THEN** the WebAudio context is `resume()`d to a running state
- **AND** subsequent sound plays do not require user-gesture re-initialization

### Requirement: Mute toggle, persisted, default unmuted

The frontend SHALL provide a mute toggle button visible in the start-screen header and the vote-screen header. The toggle's state SHALL persist to `localStorage` under the key `ballot28.muted.v1`. When the value is `"1"`, no sounds play. When the key is absent or `"0"`, sounds play. The default state on first visit is unmuted (sounds play). The button SHALL render a speaker-on icon when unmuted and a speaker-off icon when muted, and toggle on click.

#### Scenario: Mute toggle hides sound
- **WHEN** the user clicks the unmuted speaker icon
- **THEN** the icon swaps to the muted variant
- **AND** subsequent pick clicks and chimes produce no audible output
- **AND** `localStorage.getItem('ballot28.muted.v1')` returns `"1"`

#### Scenario: Mute state persists across reloads
- **WHEN** the user reloads the page after muting
- **THEN** the mute button initial state is the muted icon
- **AND** no sounds play until the user un-mutes

#### Scenario: First visit default
- **WHEN** a user with no `ballot28.muted.v1` localStorage key loads the page
- **THEN** the mute button shows the unmuted icon
- **AND** pick clicks and chimes play during voting

### Requirement: Back button resets reveal state

When the user clicks the back button to restore a previous matchup, the frontend SHALL remove `.winner`, `.loser`, `.party-D`, `.party-R`, `.party-I` classes from both cards, empty both reveal panels, and clear any pending advance timer.

#### Scenario: Back during reveal window
- **WHEN** the reveal is showing and the user clicks the back button
- **THEN** the advance timer is cancelled
- **AND** both cards return to their neutral, untinted, full-opacity state
- **AND** the prior matchup is restored on the cards
