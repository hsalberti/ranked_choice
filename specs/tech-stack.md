# Tech Stack

Two-stage hosting: **GitHub Pages for the v1 static launch**, then a
**one-vendor Cloudflare stack** once we need a real backend. Cloudflare
was chosen for free country detection via the `cf-ipcountry` header, a
generous free tier, and a single deploy surface. Postgres on Supabase
or Neon is the planned escape hatch if we outgrow D1.

## Components

| Layer        | v1 (static) choice               | Phase 1+ choice                         | Why                                              |
| ------------ | -------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Hosting      | **GitHub Pages**                 | Cloudflare Pages                        | GH Pages = zero-setup launch today. Migrate to CF Pages once the API lands. |
| API runtime  | none                             | Cloudflare Workers (TypeScript)         | Same dashboard as Pages; edge latency.           |
| Database     | none                             | Cloudflare D1 (SQLite)                  | Free tier, point-in-time restore, no servers.    |
| Geolocation  | none (browser locale fallback)   | `request.cf.country` request header     | Free, no IP-lookup vendor, low-PII.              |
| Anti-abuse   | none                             | Cloudflare Turnstile + Workers KV       | Invisible captcha + per-IP daily rate limiter.   |
| Analytics    | GitHub native traffic counter    | Cloudflare Web Analytics                | Cookieless, no fingerprinting.                   |
| Local dev    | `python3 -m http.server`         | Wrangler + Miniflare                    | Static now; first-party Workers/D1 sim later.    |
| CI/CD        | GH Pages auto-deploy on `main`   | GitHub Actions → `wrangler deploy`      | Automatic deploy on `main` in both phases.       |
| Secrets      | n/a (static)                     | Wrangler secrets + GH Actions vars      | Turnstile secret key, daily IP-hash salt.        |

## Frontend

For v1 we keep vanilla HTML/CSS/JS at the repo root (so GitHub Pages
can serve it without a build step). The bundle is tiny and the
interactions are simple enough that a framework would mostly be
overhead. Migrate to **Astro** (static + islands) if any of these
become true:

- We add more than two routes (e.g. per-country landing pages).
- We ship an embeddable widget.
- The combined roster (headline + extended) grows past ~50.

CSS stays handwritten with CSS custom properties for theming. No
Tailwind, no component library — the design is small enough to
maintain by hand and we benefit from a sub-20KB CSS payload.

## Repo layout

### v1 (current, GitHub Pages)

```
/                     # static frontend served by GH Pages
  index.html
  styles.css
  app.js
  candidates.js       # headline 25 + extended ~15 pools
/specs                # mission, tech-stack, roadmap
/research             # source material (NYT roundup, etc.)
LICENSE, README.md, .gitignore
```

### Phase 1+ target (Cloudflare)

```
/web                  # static frontend (Pages root)
  index.html
  styles.css
  app.js
  candidates.js
/api                  # Workers source (TypeScript)
  src/
    index.ts          # router
    handlers/         # stats, vote, ballot, leaderboard, comparison, event
    schema.sql
  wrangler.toml
/migrations           # D1 migrations
  0001_init.sql
  ...
/specs                # mission, tech-stack, roadmap
.github/workflows/
  deploy.yml
```

The Phase-1 restructure moves the static files into `/web` and stands
up `/api` alongside; it does not change anything user-visible.

## Schema (D1) — lands Phase 2+

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
  extended   TEXT,                    -- optional comma-joined ids for the extended ranking
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

-- Per-candidate engagement counters (Phase 1.5).
-- Click & flip aggregates from candidate detail cards, by context+country+day.
CREATE TABLE candidate_events (
  candidate_id TEXT NOT NULL,
  event_type   TEXT NOT NULL,   -- 'flip_open' | 'flip_close' | 'link_twitter' | 'link_wikipedia'
  context      TEXT NOT NULL,   -- 'matchup' | 'results'
  country      TEXT NOT NULL,   -- ISO-3166-1 alpha-2, 'ZZ' if unknown
  day          TEXT NOT NULL,   -- 'YYYY-MM-DD' UTC
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (candidate_id, event_type, context, country, day)
);

CREATE INDEX idx_pair_country     ON pair_aggregates(pair_key, country);
CREATE INDEX idx_score_country    ON candidate_country_score(country, weighted DESC);
CREATE INDEX idx_events_candidate ON candidate_events(candidate_id, day);
```

Pair keys are always `lo|hi` (sorted candidate IDs). Borda scoring:
position 1 = 5 points, 2 = 4, … , 5 = 1. The extended ranking is
persisted in `ballots.extended` but does **not** feed
`candidate_country_score` — only the top-5 drives the country
leaderboard. `candidate_events` is engagement signal only and never
influences rankings.

## HTTP contract — lands Phase 2+

All paths are under `/api`. JSON bodies and responses. CORS locked to
the production origin and `localhost:8788`.

| Method | Path                          | Body / Response                                          |
| ------ | ----------------------------- | -------------------------------------------------------- |
| GET    | `/api/health`                 | `{ ok: true, country: 'BR' }`                            |
| GET    | `/api/stats?a=X&b=Y`          | `{ country, local: { X: n, Y: n }, global: { X, Y } }`   |
| POST   | `/api/vote`                   | `{ a, b, picked, t (turnstile) }` → `204`                |
| POST   | `/api/ballot`                 | `{ picks: [...], extended?: [...], t }` → `{ id, country }` |
| GET    | `/api/ballot/:id`             | `{ picks, extended?, country, created_at }`              |
| GET    | `/api/leaderboard/:country`   | `{ top5: [{ id, score }], n }`                           |
| GET    | `/api/comparison/:country`    | `{ country_top5, country_total }`                        |
| POST   | `/api/event`                  | `{ events: [{ candidate_id, event_type, context }] }` → `204` |

POST endpoints require a valid Turnstile token and respect a
Workers-KV per-IP daily quota (50 votes / 10 ballots / 200 events).
`/api/event` is best-effort: client batches up to ~20 events and
fires them on flush; loss is acceptable.

## Candidate roster authority

- The owner curates both pools (headline 25 + extended ~15).
- The NYT's running roundup of likely 2028 contenders is the primary
  external reference (see `research/nyt-2028-candidates.md`); other
  reputable journalism may be consulted.
- The roster is frozen at v1 launch. After launch, an addition or
  removal is treated as a spec amendment, not a content update.
- Each candidate record carries optional outbound links (`twitter`,
  `wikipedia`) that power the engagement events above. <!-- inferred: link fields needed to make POST /api/event meaningful; if you don't want links rendered at all, drop them and the `link_*` event types together -->

## Privacy

- No PII stored anywhere. Country comes from the request header (Phase 1+).
- `pair_aggregates` and `candidate_events` are purely count-aggregate;
  individual sessions cannot be reconstructed from them.
- `ballots` rows carry only `{ id, picks, extended?, country, created_at }` —
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
| GitHub Pages | 100GB bandwidth / month     | n/a for a sub-100KB site         |
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

- v1: GitHub's repo traffic page for a rough hits-and-clones signal.
- Phase 1+: Cloudflare Web Analytics on Pages for traffic shape.
- Phase 1+: Workers tail logs + Logpush to R2 for 7-day retention.
- Manual dashboard query (`wrangler d1 execute`) for vote totals and
  per-country health until a Phase 6 admin UI exists.
- Error budget: < 0.5% 5xx on `/api/*` over a rolling 7-day window.
