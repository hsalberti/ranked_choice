-- Phase 1.5 backend: per-candidate engagement counters.
-- Bucketed by (candidate, event_type, context, country, day) so we
-- can answer "top candidates by Twitter clicks last 7 days" without
-- a row-per-click table.

CREATE TABLE candidate_events (
  candidate_id TEXT NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'flip_open', 'flip_close', 'link_twitter', 'link_wikipedia'
  )),
  context      TEXT NOT NULL CHECK (context IN ('matchup', 'results')),
  country      TEXT NOT NULL,
  day          TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (candidate_id, event_type, context, country, day)
);

CREATE INDEX idx_events_candidate ON candidate_events (candidate_id, day);
CREATE INDEX idx_events_day        ON candidate_events (day);
