# D1 migrations

SQL migration files for the Cloudflare D1 database powering the
backend. `wrangler` applies any `NNNN_*.sql` file in this directory in
filename order.

## Phases

- **Phase 1** (current) — no migrations yet. Worker only ships
  `/api/health`.
- **Phase 1.5** — `0002_candidate_events.sql` for engagement counters.
- **Phase 2** — `0001_pair_aggregates.sql` for per-pair country counts.
- **Phase 3** — `0003_ballots.sql` + `0004_candidate_country_score.sql`.

The canonical schema definitions live in `../specs/tech-stack.md`.

## Running

```bash
# Apply all pending migrations to the production D1.
cd ../api
wrangler d1 migrations apply ranked-choice-db --remote

# Apply locally (uses Miniflare's SQLite).
wrangler d1 migrations apply ranked-choice-db --local
```
