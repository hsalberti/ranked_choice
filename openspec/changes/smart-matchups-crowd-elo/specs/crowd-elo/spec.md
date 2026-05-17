## ADDED Requirements

### Requirement: Per-country candidate ELO table
The system SHALL provision a D1 table named `candidate_country_elo` with columns `candidate_id TEXT NOT NULL`, `country TEXT NOT NULL`, `elo REAL NOT NULL DEFAULT 1500`, `rd REAL NOT NULL DEFAULT 350`, `sigma REAL NOT NULL DEFAULT 0.06`, `n_ballots INTEGER NOT NULL DEFAULT 0`, `updated_at INTEGER NOT NULL`, with primary key `(candidate_id, country)`. A migration SHALL create this table without backfilling existing data.

#### Scenario: Migration applies cleanly
- **WHEN** the migration is applied against an empty D1 database
- **THEN** the table exists with the specified schema
- **AND** the primary key uniquely indexes `(candidate_id, country)`

#### Scenario: Rows are created lazily on first vote
- **WHEN** a vote arrives for a `(candidate_id, country)` pair that has no row
- **THEN** the vote handler inserts a new row at the default rating (1500), default RD (350), default sigma (0.06), `n_ballots` initialized to the count implied by the vote, and `updated_at` set to the current epoch milliseconds

### Requirement: Incremental Glicko-2 update on vote
On each successful `POST /api/vote` request that passes validation and the abuse gate, the system SHALL apply one Glicko-2 update step to the `(picked, country)` and `(loser, country)` rows. Both candidates are updated atomically against their pre-vote ratings.

#### Scenario: Vote updates both candidates
- **WHEN** a valid vote arrives with `picked = "vance"`, `loser = "newsom"`, `country = "BR"`
- **THEN** the `(vance, BR)` row's `elo` increases and its `rd` shrinks slightly
- **AND** the `(newsom, BR)` row's `elo` decreases and its `rd` shrinks slightly
- **AND** both rows' `updated_at` are set to the current epoch milliseconds

#### Scenario: Atomic update against pre-vote ratings
- **WHEN** two concurrent vote requests for the same `(pair, country)` arrive
- **THEN** each update is applied against the snapshot of ratings observed at the start of its transaction
- **AND** both updates persist (last-writer-wins is acceptable for individual rows but neither vote is silently dropped)

### Requirement: Global ELO endpoint
The system SHALL expose `GET /api/elo` with query parameters `country` (optional, ISO-2 uppercase; if absent or `GLOBAL`, the response is aggregated across all countries), `party` (optional, one of `R`, `D`, `I`, `all`; default `all`), and `limit` (optional, integer 1–50, default 25). The response SHALL be a JSON array of `{ id, elo, rd, n_ballots, party }` objects sorted by `elo` descending.

#### Scenario: Country-filtered response
- **WHEN** a client requests `GET /api/elo?country=BR&party=R&limit=10`
- **THEN** the response is a JSON array of at most 10 entries, each with `party === "R"`
- **AND** entries are derived from `(candidate_id, "BR")` rows
- **AND** entries are sorted by `elo` descending

#### Scenario: Global aggregation
- **WHEN** a client requests `GET /api/elo` without a `country` parameter, or with `country=GLOBAL`
- **THEN** the response aggregates each candidate across all `country` values, weighting the per-country ELOs by `n_ballots`
- **AND** the response includes a summed `n_ballots` per candidate

### Requirement: Min-N gating on country views
For any specific-country request, the system SHALL omit candidates whose `n_ballots` for that country is below 20. The Global view SHALL have no min-N gating beyond rows existing in the table. The min-N threshold MUST be configurable via the Worker environment variable `ELO_MIN_N` (default `20`).

#### Scenario: Sparse country hides low-N candidates
- **WHEN** a client requests `GET /api/elo?country=LV`
- **AND** only 5 candidates have `n_ballots >= 20` for Latvia
- **THEN** the response contains exactly those 5 candidates

#### Scenario: Global view ignores min-N
- **WHEN** a client requests `GET /api/elo?country=GLOBAL`
- **THEN** the response contains every candidate with at least one row in the table

#### Scenario: Configurable threshold
- **WHEN** `ELO_MIN_N=50` is set on the Worker
- **THEN** the min-N gate uses 50, not the default 20

### Requirement: Endpoint hardening
`GET /api/elo` SHALL share the existing Phase-5 abuse posture: invalid `country` (non-uppercase ISO-2 except the literal `GLOBAL`), invalid `party` (anything outside `R`/`D`/`I`/`all`), or out-of-range `limit` SHALL return HTTP 400. The endpoint SHALL be subject to the same KV rate-limit bucket as the existing `/api/leaderboard` endpoint.

#### Scenario: Bad country code rejected
- **WHEN** a client requests `GET /api/elo?country=Brazil`
- **THEN** the server returns HTTP 400 with a JSON `{ error: "invalid_country" }` body
