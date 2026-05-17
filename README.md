# The 2028 Ballot

A tiny mobile-first webapp that walks you through 25 head-to-head matchups
between possible 2028 presidential candidates, then produces a ranked-choice
top 5 you can share like a Wordle score. Politically inclined visitors can
opt into a second "long-tail" round of ~15 more candidates.

Live: <https://hsalberti.github.io/ranked_choice/>

## Run it

Static site — open `index.html` in a browser, or serve it locally:

```bash
python3 -m http.server 8765
# then visit http://localhost:8765
```

No build step, no dependencies.

## How it works

- `candidates.js` — the 25-candidate headline roster plus a ~15-candidate
  extended pool. Each record carries `hook`, `bio_long`, `storyline`,
  `policy[]`, `moment`, `links.twitter`, `links.wikipedia`.
- `app.js` — generates a matchup schedule (each candidate appears twice),
  runs Elo-style updates after each pick to produce a full ranking, and
  builds the shareable summary. The same module handles the optional
  extended round and the engagement-event queue.
- `styles.css` — handcrafted CSS with light/dark mode, 3D card flip on
  the matchup card, and a results-screen bottom-sheet for candidate
  details. No framework.

The "what other voters chose" overlay shown after each vote is a
deterministic, hash-seeded estimate computed in the browser — until
Phase 2 lands, there is no backend.

## Sharing

Copy-to-clipboard produces a Wordle-shaped summary plus a deep link
that encodes the picks (`?b=ramaswamy,buttigieg,…` for the top-5 and
optional `&x=pritzker,abbott,…` for the long tail). Opening that link
shows the friend's ballot above the "start voting" CTA so the
recipient can build their own and compare.

## Tier list

After voting, scrolling past the share section reveals a TierMaker-style
tier list of the candidates. The same view also lives at a dedicated
hash route — `https://2028ballot.almaintel.com/#/tiers` — handy for
direct sharing or dropping into an OBS browser source.

- **Roster size pills (top-right)** — `15` (default, S2/A3/B4/C6), `25`
  (adds D8), `40` (adds D8 + F15).
- **Source pills** — `Global` (crowd Elo from `/api/elo`) or `Mine`
  (this session's personal Glicko ratings; enabled after 5 votes).
- **Save as image** — exports the current view as a 1200×630 PNG with a
  small site watermark. No round-trip; the canvas render is client-side.
- **How?** — opens the civic explainer with two sections: how the Elo
  math turns pairwise votes into tiers, and a plain-English description
  of ranked-choice voting (also reachable from the `(i)` icon next to
  "Your top 5" on the results screen).

Selections persist in `localStorage` under `tierList.rosterSize` and
`tierList.source`. The Global cache is held in-memory for 5 minutes so
toggling roster size doesn't re-hit `/api/elo`.

## Keyboard

- `1` / `←` — pick the left candidate
- `2` / `→` — pick the right candidate
- `Space` / `Enter` — skip the matchup
- `ⓘ` on a card flips it to the long-form back; ← flips back

---

## Backend setup

The Cloudflare Worker lives in `api/` and powers `/api/health`,
`/api/event` (Phase 1.5), `/api/vote` + `/api/stats` (Phase 2),
`/api/ballot` + `/api/ballot/:id` + `/api/leaderboard/:country`
(Phase 3), `/api/comparison/:country` (Phase 4).

**Prereqs:** a Cloudflare account.

### Local dev (no Cloudflare account needed yet)

```bash
cd api
npm install
npm run dev          # wrangler dev — Worker on http://127.0.0.1:8787 + local SQLite D1
```

In another terminal, apply migrations to the local D1 once:

```bash
cd api
wrangler d1 migrations apply ranked-choice-db --local
```

Then serve the frontend on a separate port:

```bash
# repo root
python3 -m http.server 8765
# open http://127.0.0.1:8765
```

The frontend auto-points at `http://127.0.0.1:8787` whenever the host
is localhost; everywhere else it points at the deployed Worker (see
`API_BASE_URL` in `app.js`).

### Production: first deploy

```bash
cd api

# 1. Authenticate.
wrangler login

# 2. Create the production D1 once. Copy the returned UUID.
wrangler d1 create ranked-choice-db

# 3. Paste the UUID into api/wrangler.toml under [[d1_databases]] →
#    database_id (replacing the "ranked-choice-db-local" placeholder).

# 4. Apply migrations against the remote DB.
wrangler d1 migrations apply ranked-choice-db --remote

# 5. Deploy the Worker.
wrangler deploy
# → outputs https://ranked-choice-api.<your-subdomain>.workers.dev
```

Verify:

```bash
curl https://ranked-choice-api.<your-subdomain>.workers.dev/api/health
# → {"ok":true,"country":"BR"}
```

If the deployed Worker name isn't `ranked-choice-api.bardeus.workers.dev`,
update the prod URL constant in `app.js` (`API_BASE_URL` derivation).

### Continuous deployment

The Cloudflare dashboard "Connect Git" feature watches `main` and
re-runs `wrangler deploy` + `wrangler d1 migrations apply --remote` on
every push that touches `api/` or `migrations/`. Set this up once
under **Workers & Pages → ranked-choice-api → Settings → Build**;
after that, no GitHub Actions secrets or workflow files are needed.

Frontend deploys analogously through Cloudflare Pages' git integration.

### Turnstile + KV (optional anti-abuse hardening)

```bash
wrangler kv namespace create RATE_LIMIT   # paste id into wrangler.toml
wrangler secret put TURNSTILE_SECRET
wrangler secret put DAILY_SALT
```

### Smoke tests

Two scripts cover the backend:

```bash
# 37 correctness assertions: CORS, validation, pair-key canonicalization,
# Borda math, admin auth, routing. Run after deploy:
./scripts/test_api.sh                                  # local wrangler dev
./scripts/test_api.sh https://your-worker.workers.dev  # production

# To exercise admin routes:
ADMIN_TOKEN="$(cat api/.dev.vars | grep ADMIN_TOKEN | cut -d= -f2)" \
  ./scripts/test_api.sh http://127.0.0.1:8787
```

```bash
# Proves real aggregation: wipes the local D1, posts 100 votes
# (70 ramaswamy / 30 vance), reads /api/stats, asserts 70/30 split.
./scripts/test_multiuser.sh                            # local — wipes D1 first
./scripts/test_multiuser.sh https://your-worker.dev    # against prod, does NOT wipe
```

### Quick admin queries (D1)

```bash
# Top-voted candidate per country, last 7 days:
wrangler d1 execute ranked-choice-db --remote --command \
  "SELECT country, picked_id, SUM(votes) v FROM pair_aggregates GROUP BY country, picked_id ORDER BY country, v DESC LIMIT 50;"

# Candidate-detail flip leaders:
wrangler d1 execute ranked-choice-db --remote --command \
  "SELECT candidate_id, SUM(count) total FROM candidate_events WHERE event_type='flip_open' GROUP BY candidate_id ORDER BY total DESC LIMIT 10;"

# Country leaderboard, raw:
wrangler d1 execute ranked-choice-db --remote --command \
  "SELECT * FROM candidate_country_score WHERE country='BR' ORDER BY weighted DESC LIMIT 5;"

# v2 — crowd ELO per country (min 20 ballots, default ELO_MIN_N):
wrangler d1 execute ranked-choice-db --remote --command \
  "SELECT candidate_id, ROUND(elo) elo, ROUND(rd) rd, n_ballots FROM candidate_country_elo WHERE country='BR' AND n_ballots >= 20 ORDER BY elo DESC LIMIT 15;"

# v2 — global aggregated ELO (n_ballots-weighted across countries):
wrangler d1 execute ranked-choice-db --remote --command \
  "SELECT candidate_id, ROUND(SUM(elo*n_ballots)*1.0/SUM(n_ballots)) elo, SUM(n_ballots) total FROM candidate_country_elo WHERE n_ballots > 0 GROUP BY candidate_id ORDER BY elo DESC LIMIT 15;"
```

---

## Repo layout

```
/                # static frontend served by GH Pages today
  index.html
  app.js
  candidates.js
  styles.css
  pics/          # candidate photos (manifest-driven)
/api             # Cloudflare Worker (Phase 1+)
  src/index.ts
  wrangler.toml
  ...
/migrations      # D1 SQL migrations (Phase 2+)
/specs           # mission, tech-stack, roadmap — the project constitution
/research        # external source material (NYT roundup, etc.)
.github/workflows/deploy.yml
```

At the Phase 1 cutover the static files move to `/web/` and Cloudflare
Pages takes over from GitHub Pages; the GH Pages URL will redirect to
the custom domain so existing share links keep working.
