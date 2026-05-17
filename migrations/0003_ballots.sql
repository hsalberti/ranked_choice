-- Phase 3: submitted top-5 ballots (deep-link target + leaderboard
-- input). `extended` carries the optional long-tail ranking encoded
-- as a comma-joined id list; not used by the leaderboard.

CREATE TABLE ballots (
  id         TEXT PRIMARY KEY,
  picks      TEXT NOT NULL,
  extended   TEXT,
  country    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_ballots_country_created
  ON ballots (country, created_at DESC);
