# Capability: crowd-elo (delta)

This delta extends the `crowd-elo` capability introduced in `smart-matchups-crowd-elo` with: (1) per-candidate ELO and rank on the `/api/stats` response, (2) a country-activation threshold that controls country-vs-global scope selection, and (3) a stricter 10-vote leaderboard floor on `GET /api/elo` GLOBAL. It also explicitly retires the prior tier-gating on `POST /api/vote` clients.

## ADDED Requirements

### Requirement: `/api/stats` returns ELO for both candidates

`GET /api/stats?a=X&b=Y` SHALL include an `elo` field in its response body, shaped as `{ [a_id]: number | null, [b_id]: number | null }`. The ELO value SHALL be the weighted GLOBAL average computed as `SUM(elo * n_ballots) / SUM(n_ballots)` aggregated across all country rows in `candidate_country_elo` for that candidate. If a candidate has no rows in `candidate_country_elo` (no votes recorded yet), its ELO value SHALL be `null`.

#### Scenario: Both candidates have global ELO data
- **WHEN** a client requests `GET /api/stats?a=vance&b=newsom`
- **AND** both candidates have multiple country rows in `candidate_country_elo`
- **THEN** the response includes `elo: { vance: <number>, newsom: <number> }`
- **AND** each value is the `n_ballots`-weighted average across all that candidate's country rows
- **AND** each value is a number, not null

#### Scenario: One candidate has no vote data
- **WHEN** a client requests `GET /api/stats?a=X&b=Y` where Y has zero rows in `candidate_country_elo`
- **THEN** the response includes `elo: { X: <number>, Y: null }`

### Requirement: `/api/stats` returns rank for both candidates

`GET /api/stats?a=X&b=Y` SHALL include a `rank` field shaped as `{ [a_id]: number | null, [b_id]: number | null }`. For each candidate, rank SHALL be computed as `1 + COUNT(other_candidates WHERE other.globalElo > self.globalElo AND other.totalNBallots >= 10)`, where `globalElo` is the weighted GLOBAL average and `totalNBallots` is `SUM(n_ballots)` across all country rows. If the candidate's own `totalNBallots < 10`, the rank for that candidate SHALL be `null`.

#### Scenario: Both candidates ranked
- **WHEN** both candidates in the pair have `totalNBallots >= 10`
- **THEN** the response's `rank` field has integer values for both
- **AND** the rank reflects each candidate's position in the global ranking among all candidates with `>= 10` votes

#### Scenario: One candidate below floor
- **WHEN** candidate X has `totalNBallots = 4`
- **THEN** the response's `rank.X` is `null`
- **AND** X is also excluded from the rank-counting denominator for the other candidate (does not lower other candidates' ranks)

#### Scenario: Tie in ELO
- **WHEN** two candidates have identical weighted global ELOs and both are above the floor
- **THEN** both receive the same rank (no tiebreak imposed)
- **AND** the next-lower candidate receives a rank that accounts for the tie (i.e., rank counts strictly-greater ELOs only)

### Requirement: `/api/stats` returns scope indicator

`GET /api/stats?a=X&b=Y` SHALL include a `scope` field whose value is either the literal string `"GLOBAL"` or an ISO-2 uppercase country code. The scope SHALL be the country code if the visitor's country (per `countryOf(request)`) has accumulated `SUM(votes) >= 10000` across all rows in `pair_aggregates` for that country; otherwise the scope SHALL be `"GLOBAL"`. The Worker MAY cache the country-total computation in-memory with a TTL of up to 5 minutes; correctness SHALL NOT depend on per-second accuracy of the threshold check.

#### Scenario: Visitor from high-volume country
- **WHEN** a visitor from country C requests `/api/stats?a=X&b=Y`
- **AND** country C has `SUM(votes) >= 10000` across `pair_aggregates WHERE country = 'C'`
- **THEN** the response's `scope` field equals `"C"` (uppercase ISO-2)

#### Scenario: Visitor from low-volume country
- **WHEN** a visitor from country D requests `/api/stats?a=X&b=Y`
- **AND** country D has `SUM(votes) < 10000`
- **THEN** the response's `scope` field equals `"GLOBAL"`
- **AND** the `local` and `global` count fields are still both populated (the existing contract is preserved)

### Requirement: Leaderboard 10-vote floor

`GET /api/elo` with no `country` parameter or `country=GLOBAL` SHALL exclude candidates whose summed `n_ballots` across all country rows is less than 10. The country-specific branch retains its existing `ELO_MIN_N` gate (default 20).

#### Scenario: Candidate just below floor
- **WHEN** candidate X has `SUM(n_ballots) = 9` across country rows
- **AND** a client requests `GET /api/elo?country=GLOBAL`
- **THEN** X is absent from the response array

#### Scenario: Candidate at floor
- **WHEN** candidate Y has `SUM(n_ballots) = 10`
- **THEN** Y is present in the response array (assuming party filter passes)

#### Scenario: All candidates below floor
- **WHEN** every candidate has `SUM(n_ballots) < 10`
- **THEN** `GET /api/elo?country=GLOBAL` returns an empty array (`[]`), not an error

### Requirement: `POST /api/vote` accepts all-tier votes

`POST /api/vote` SHALL accept any valid `(a, b, picked)` triple regardless of which tier the candidates belong to. The backend SHALL NOT inspect or enforce tier membership. The frontend SHALL send all Tier 1, Tier 2, and Tier 3 vote clicks to `POST /api/vote`, dropping any prior client-side `if (activeTier === 1)` gate.

#### Scenario: Tier 2 vote accepted
- **WHEN** the frontend sends `POST /api/vote { a: "ramaswamy", b: "ossoff", picked: "ramaswamy" }` (both Tier 2)
- **THEN** the request is accepted (HTTP 204)
- **AND** rows are inserted/updated in `pair_aggregates` and `candidate_country_elo` exactly as for any other vote

#### Scenario: Tier 3 vote accepted
- **WHEN** the frontend sends `POST /api/vote` for a Tier 3 pair
- **THEN** the request is accepted
- **AND** both candidates' `candidate_country_elo` rows update

#### Scenario: Cross-tier vote accepted
- **WHEN** the frontend sends a vote where one candidate is Tier 1 and the other is Tier 3 (e.g., from the back-button restoring an earlier pair after the user opted into Tier 3)
- **THEN** the request is accepted with no special handling
