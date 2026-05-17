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

## Keyboard

- `1` / `←` — pick the left candidate
- `2` / `→` — pick the right candidate
- `Space` / `Enter` — skip the matchup
- `ⓘ` on a card flips it to the long-form back; ← flips back

---

## Backend setup (Phase 1)

The Cloudflare Worker scaffold lives in `api/`. After Phase 1 deploys,
the frontend will call `/api/health` to surface the visitor's country.

**Prereqs:** a Cloudflare account.

```bash
# 1. Install Wrangler + types (in api/).
cd api
npm install

# 2. Authenticate Wrangler.
wrangler login

# 3. Deploy the Worker for the first time.
wrangler deploy
# → outputs something like https://ranked-choice-api.<your-subdomain>.workers.dev
```

Visit `https://ranked-choice-api.<your-subdomain>.workers.dev/api/health`
and confirm it returns `{ "ok": true, "country": "BR" }` (or wherever
you are).

### CI deployment

`.github/workflows/deploy.yml` runs `wrangler deploy` on every push to
`main` that touches `api/`, `migrations/`, or the workflow itself.
Two repo secrets are required:

```bash
# Create a scoped Cloudflare API token at:
#   https://dash.cloudflare.com/profile/api-tokens
# Template: "Edit Cloudflare Workers" (or custom: Workers Scripts:Edit,
# D1:Edit, Workers KV Storage:Edit on the account).

gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID   # 32-char hex from the dashboard sidebar
```

### Phase 2 — D1 setup (later)

When you're ready to ingest real votes:

```bash
cd api
wrangler d1 create ranked-choice-db
# Paste the printed database_id into wrangler.toml under [[d1_databases]]
# and uncomment that block + the migrations_dir.

# First migration applied locally (Miniflare SQLite):
wrangler d1 migrations apply ranked-choice-db --local

# And remotely:
wrangler d1 migrations apply ranked-choice-db --remote
```

The migration SQL files live in `../migrations/`. Schema definitions
are in `specs/tech-stack.md`.

### Phase 5 — Turnstile + KV (much later)

```bash
wrangler kv namespace create RATE_LIMIT   # paste id into wrangler.toml
wrangler secret put TURNSTILE_SECRET
wrangler secret put DAILY_SALT
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
