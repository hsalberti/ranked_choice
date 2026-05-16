# Tech Stack

One-vendor Cloudflare stack, chosen for free country detection via the
`cf-ipcountry` header, a generous free tier, and a single deploy
surface. Postgres on Supabase or Neon is the planned escape hatch if we
outgrow D1.

## Components

| Layer        | Choice                                  | Why                                              |
| ------------ | --------------------------------------- | ------------------------------------------------ |
| Hosting      | Cloudflare Pages                        | Static, edge-cached, GitHub-integrated.          |
| API runtime  | Cloudflare Workers (TypeScript)         | Same dashboard as Pages; edge latency.           |
| Database     | Cloudflare D1 (SQLite)                  | Free tier, point-in-time restore, no servers.    |
| Geolocation  | `request.cf.country` request header     | Free, no IP-lookup vendor, low-PII.              |
| Anti-abuse   | Cloudflare Turnstile + Workers KV       | Invisible captcha + per-IP daily rate limiter.   |
| Analytics    | Cloudflare Web Analytics                | Cookieless, no fingerprinting.                   |
| Local dev    | Wrangler + Miniflare                    | First-party Workers/D1 local sim.                |
| CI/CD        | GitHub Actions → `wrangler deploy`      | Automatic deploy on `main`.                      |
| Secrets      | Wrangler secrets + GitHub Actions vars  | Turnstile secret key, daily IP-hash salt.        |

## Frontend

For v1 we keep vanilla HTML/CSS/JS under `/web`. The bundle is tiny and
the interactions are simple enough that a framework would mostly be
overhead. Migrate to **Astro** (static + islands) if any of these become
true:

- We add more than two routes (e.g. per-country landing pages).
- We ship an embeddable widget.
- The candidate roster grows past ~50 and we need data-driven page
  generation.

CSS stays handwritten with CSS custom properties for theming. No
Tailwind, no component library — the design is small enough to
maintain by hand and we benefit from a sub-20KB CSS payload.

## Repo layout (target)

```
/web                  # static frontend (Pages root)
  index.html
  styles.css
  app.js
  candidates.js
/api                  # Workers source (TypeScript)
  src/
    index.ts          # router
    handlers/         # stats, vote, ballot, leaderboard, comparison
    schema.sql
  wrangler.toml
/migrations           # D1 migrations
  0001_init.sql
  ...
/constitution         # mission, techstack, roadmap
.github/workflows/
  deploy.yml
```

## Schema (D1)

```sql
-- Per-pair aggregate counts; primary surface for the stats overlay.
CREATE TABLE pair_aggregates (
  pair_key   TEXT NOT NULL,   -- canonical sorted '{lo}|{hi}'
  country    TEXT NOT NULL,   -- ISO-3166-1 alpha-2, 'ZZ' if unknown
  picked_id  TEXT NOT NULL,
  votes      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pair_key, country, picked_id)
);

-- Submitted final top-5 ballots (deep-link target + leaderboard input).
CREATE TABLE ballots (
  id         TEXT PRIMARY KEY,        -- short ULID for ?b= links
  picks      TEXT NOT NULL,           -- comma-joined ids, top-5 first
  country    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Country-level candidate scoreboard, derived from ballots (Borda).
CREATE TABLE candidate_country_score (
  country     TEXT NOT NULL,
  candidate   TEXT NOT NULL,
  weighted    REAL NOT NULL DEFAULT 0,
  appearances INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (country, candidate)
);

CREATE INDEX idx_pair_country  ON pair_aggregates(pair_key, country);
CREATE INDEX idx_score_country ON candidate_country_score(country, weighted DESC);
```

Pair keys are always `lo|hi` (sorted candidate IDs). Borda scoring:
position 1 = 5 points, 2 = 4, … , 5 = 1.

## HTTP contract

All paths are under `/api`. JSON bodies and responses. CORS locked to
the production origin and `localhost:8788`.

| Method | Path                          | Body / Response                                          |
| ------ | ----------------------------- | -------------------------------------------------------- |
| GET    | `/api/health`                 | `{ ok: true, country: 'BR' }`                            |
| GET    | `/api/stats?a=X&b=Y`          | `{ country, local: { X: n, Y: n }, global: { X, Y } }`   |
| POST   | `/api/vote`                   | `{ a, b, picked, t (turnstile) }` → `204`                |
| POST   | `/api/ballot`                 | `{ picks: [...], t }` → `{ id, country }`                |
| GET    | `/api/ballot/:id`             | `{ picks, country, created_at }`                         |
| GET    | `/api/leaderboard/:country`   | `{ top5: [{ id, score }], n }`                           |
| GET    | `/api/comparison/:country`    | `{ country_top5, country_total }`                        |

POST endpoints require a valid Turnstile token and respect a
Workers-KV per-IP daily quota (50 votes / 10 ballots).

## Privacy

- No PII stored anywhere. Country comes from the request header.
- `pair_aggregates` is purely count-aggregate; individual sessions
  cannot be reconstructed from it.
- `ballots` rows carry only `{ id, picks, country, created_at }` —
  no IP, no session ID, no user agent.
- IP appears only inside the rate-limit KV key, hashed with a daily
  rotating salt: `sha256(ip + DAILY_SALT)`. KV entries TTL after 24h.
- No tracking cookies. No third-party scripts. Fonts are system
  fonts.
- GDPR posture: aggregate analytics only, no profile data, no consent
  banner required.

## Cost ceiling

| Service      | Free tier                   | Approx. headroom (free)          |
| ------------ | --------------------------- | -------------------------------- |
| Workers      | 100k requests / day         | ~2,000 completed ballots / day   |
| D1           | 5M reads, 100k writes / day | ~3,000 ballots / day             |
| KV           | 100k reads, 1k writes / day | rate-limit slot only             |
| Pages        | unlimited requests          | n/a                              |
| Turnstile    | unlimited                   | n/a                              |
| Web Analytics| unlimited                   | n/a                              |

**Upgrade trigger:** sustained 70%+ utilization of any free-tier quota
for one week, or any 24h period where requests get throttled. Workers
Paid is $5/mo and lifts request limits ~100×.

## Observability

- Cloudflare Web Analytics on Pages for traffic shape.
- Workers tail logs + Logpush to R2 for 7-day retention.
- Manual dashboard query (`wrangler d1 execute`) for vote totals and
  per-country health until a Phase 6 admin UI exists.
- Error budget: < 0.5% 5xx on `/api/*` over a rolling 7-day window.
