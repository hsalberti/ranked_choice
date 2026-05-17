-- Phase 2: per-pair aggregate vote counts powering the stats overlay.
-- pair_key is the canonical sorted '{lo}|{hi}' so the order users see
-- A vs B never matters. country = ISO-3166-1 alpha-2 (or 'ZZ' when
-- the edge can't determine it).

CREATE TABLE pair_aggregates (
  pair_key   TEXT NOT NULL,
  country    TEXT NOT NULL,
  picked_id  TEXT NOT NULL,
  votes      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pair_key, country, picked_id)
);

CREATE INDEX idx_pair_country ON pair_aggregates (pair_key, country);
