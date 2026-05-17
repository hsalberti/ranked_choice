-- Phase 3: country-level candidate scoreboard. Borda-weighted from
-- the top-5 of each ballot (rank 1 = 5 pts, … rank 5 = 1 pt). The
-- extended-pool ranking does NOT feed this table.

CREATE TABLE candidate_country_score (
  country     TEXT NOT NULL,
  candidate   TEXT NOT NULL,
  weighted    REAL NOT NULL DEFAULT 0,
  appearances INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (country, candidate)
);

CREATE INDEX idx_score_country
  ON candidate_country_score (country, weighted DESC);
