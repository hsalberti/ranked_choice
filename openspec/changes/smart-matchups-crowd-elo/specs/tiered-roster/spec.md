## ADDED Requirements

### Requirement: Three-tier roster classification
The system SHALL classify every candidate in `candidates.js` into exactly one of three tiers via a `tier` field with value `1`, `2`, or `3`. Tier 1 contains the top cohort of 15 candidates, Tier 2 contains 12 candidates, and Tier 3 contains 13 candidates.

#### Scenario: Every candidate has a tier
- **WHEN** the candidate roster loads
- **THEN** every record in the combined headline + extended pool has a `tier` value of `1`, `2`, or `3`
- **AND** the counts are exactly 15 / 12 / 13

#### Scenario: Two extended names promote to Tier 1
- **WHEN** the candidate roster loads
- **THEN** `trumpjr` has `tier: 1` and `pritzker` has `tier: 1`
- **AND** they no longer appear in any `EXTENDED_CANDIDATES`-style pool

### Requirement: Tier-1 voting is the required first flow
The system SHALL start every new ballot in Tier 1 and SHALL NOT allow opt-in into Tier 2 or Tier 3 before Tier 1 has reached a stop condition.

#### Scenario: First-time voter begins in Tier 1
- **WHEN** a user clicks the start button on a fresh session
- **THEN** the matchup engine selects only candidates whose `tier === 1`
- **AND** Tier-2 and Tier-3 candidates do not appear

#### Scenario: Tier-2 CTA is gated on Tier-1 completion
- **WHEN** Tier 1 has not yet reached a stop condition
- **THEN** the "Keep voting · 12 more" CTA is hidden on the results screen
- **AND** Tier 3 is also hidden

### Requirement: ELO carries forward across tiers
The system SHALL preserve each candidate's Glicko-2 rating and rating deviation from Tier 1 into Tier 2 voting, and from Tier 2 into Tier 3 voting. The top-5 ballot displayed on the results screen SHALL reflect the latest ratings across all tiers the user has opted into.

#### Scenario: Tier-2 votes refine Tier-1 ranks
- **WHEN** a user finishes Tier 1 with `vance` at rank 1 and `rubio` at rank 3
- **AND** opts into Tier 2 and consistently picks `hegseth` over `rubio`
- **THEN** the top-5 displayed after Tier 2 may show `rubio` dropping below `hegseth`
- **AND** no candidate's Glicko rating resets between tiers

#### Scenario: Cross-tier matchups do not occur within a single tier
- **WHEN** the user is voting in Tier 2
- **THEN** every matchup presented is between two Tier-2 candidates only
- **AND** Tier-1 and Tier-3 candidates are not paired with Tier-2 candidates

### Requirement: Opt-in CTAs after each tier
After Tier 1 reaches a stop condition the results screen SHALL show a "Keep voting · 12 more" CTA. After Tier 2 reaches a stop condition the results screen SHALL show a "Go deeper · 13 more" CTA. Both CTAs SHALL be skippable without penalty (the share artifact is valid at any tier boundary).

#### Scenario: Skipping Tier 2 still produces a shareable ballot
- **WHEN** the user reaches the results screen after Tier 1
- **AND** dismisses the "Keep voting" CTA without clicking it
- **THEN** the share button still copies a valid top-5 + URL
- **AND** the URL deep-link resolves correctly when opened by a friend
