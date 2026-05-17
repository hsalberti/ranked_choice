-- v2 (smart-matchups-crowd-elo): per-(candidate, country) Glicko-2 ELO.
--
-- Each successful POST /api/vote applies one Glicko-2 step to the two
-- rows for (picked, country) and (loser, country). Rows are created
-- lazily on first vote at the default rating (1500), RD (350), σ (0.06).
--
-- Country is ISO-3166-1 alpha-2 (or 'ZZ' when the edge can't determine
-- one). Global views aggregate across countries on-read, weighting elo
-- by n_ballots and summing n_ballots.

CREATE TABLE candidate_country_elo (
  candidate_id  TEXT     NOT NULL,
  country       TEXT     NOT NULL,
  elo           REAL     NOT NULL DEFAULT 1500,
  rd            REAL     NOT NULL DEFAULT 350,
  sigma         REAL     NOT NULL DEFAULT 0.06,
  n_ballots     INTEGER  NOT NULL DEFAULT 0,
  updated_at    INTEGER  NOT NULL,
  PRIMARY KEY (candidate_id, country)
);

CREATE INDEX idx_elo_country ON candidate_country_elo (country, elo DESC);
CREATE INDEX idx_elo_candidate ON candidate_country_elo (candidate_id);
