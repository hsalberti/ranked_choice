# Website setup: `2028ballot.almaintel.com`

What you need to do to point the custom domain at the site.
`almaintel.com` is registered + DNS-hosted at **Hostinger**; the site
itself lives on Cloudflare. We keep DNS at Hostinger and use a single
CNAME — no need to move the whole zone.

---

## What we're wiring

```
Browser
   │
   ▼
https://2028ballot.almaintel.com/         ← Cloudflare Pages
   │      (serves index.html + app.js + candidates.js + pics/…)
   │
   │      fetch('https://ranked-choice-api.<your-subdomain>
   │             .workers.dev/api/health')
   ▼
Cloudflare Worker (separate origin)        ← Phase 1+ backend
```

Frontend on **Cloudflare Pages** (custom domain via Hostinger CNAME).
Backend (`/api/*`) on a separate **Cloudflare Worker** at
`*.workers.dev`. The frontend calls the Worker cross-origin; CORS on
the Worker explicitly allows `https://2028ballot.almaintel.com`.

> **Why not put both on the same domain?** That would need
> `almaintel.com` to be on Cloudflare DNS, which means moving the
> nameservers off Hostinger. Doing that affects every service on
> `almaintel.com` (mail, other subdomains, etc.) so it's a bigger
> decision — see the "Optional: consolidate later" section at the
> bottom.

---

## Step 1 — Cloudflare Pages project (5 min)

1. Sign in at <https://dash.cloudflare.com>.
2. Sidebar → **Workers & Pages** → **Create application** → **Pages**
   tab → **Connect to Git**.
3. Authorize Cloudflare for the GitHub account that owns
   `hsalberti/ranked_choice`. Select the repo.
4. Set up build:
   - **Production branch:** `main`
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/` (or empty / root)
   - **Root directory:** *(leave blank)*
5. Save and deploy. First build takes ~30 seconds; the project gets a
   URL like `https://ranked-choice-XXX.pages.dev`. Open it and confirm
   the site loads there.

## Step 2 — Add the custom domain in Cloudflare Pages (2 min)

1. In the Pages project → **Custom domains** → **Set up a custom
   domain**.
2. Enter `2028ballot.almaintel.com`. Submit.
3. Cloudflare shows the **CNAME target** you need at Hostinger. It
   looks like:
   ```
   2028ballot.almaintel.com  CNAME  ranked-choice-XXX.pages.dev
   ```
   Copy that target value — you need it in the next step.

## Step 3 — Add the CNAME at Hostinger (3 min)

1. Sign in at <https://hpanel.hostinger.com>.
2. Top nav → **Domains** → click `almaintel.com` → **DNS / Nameservers**
   (or sometimes labeled **DNS Zone Editor**).
3. **Add a new DNS record:**
   - **Type:** `CNAME`
   - **Name** (or **Host**): `2028ballot`
     *(just the subdomain part — Hostinger appends `.almaintel.com`
     automatically.)*
   - **Points to** (or **Target** / **Value**): the `ranked-choice-XXX.pages.dev`
     target Cloudflare gave you in Step 2.
   - **TTL:** leave the default (3600 s / 1 h). You can use 300 s
     temporarily if you want fast propagation while testing.
4. Save / Add Record.

## Step 4 — Wait for DNS + SSL (5–30 min)

- DNS propagation: usually under 10 min for a fresh subdomain.
  Validate with `dig`:
  ```bash
  dig +short 2028ballot.almaintel.com CNAME
  # → ranked-choice-XXX.pages.dev.
  ```
- Cloudflare auto-provisions a Let's Encrypt SSL cert. The custom
  domain row in the Pages dashboard turns green ("Active").
- Visit `https://2028ballot.almaintel.com/` — should serve the site.

## Step 5 — Worker deploy (separate, also Phase 1)

The static site is done. For the API:

```bash
cd api
wrangler login        # opens browser; pick your CF account
wrangler deploy
# → https://ranked-choice-api.<your-subdomain>.workers.dev
```

Confirm:

```bash
curl https://ranked-choice-api.<your-subdomain>.workers.dev/api/health
# → {"ok":true,"country":"BR"}
```

The Worker's CORS allow-list already includes
`https://2028ballot.almaintel.com`, so the frontend can call it from
the custom domain.

## Step 6 — Continuous deployment via Cloudflare "Connect Git"

In the Cloudflare dashboard, open **Workers & Pages → ranked-choice-api
→ Settings → Build & Deploy → Connect Git** and point it at this repo
+ `main`. Set the build directory to `api/`. Cloudflare will run
`wrangler deploy` and apply pending D1 migrations on every push that
touches `api/` or `migrations/`.

Frontend (Cloudflare Pages) uses the same git integration — no
GitHub Actions, no API tokens to manage.

---

## Step 7 — Switch the live URL (when you're ready)

GitHub Pages stays live throughout this. Once
`https://2028ballot.almaintel.com/` works end-to-end:

1. Update README's "Live" line and any social/share copy from the GH
   Pages URL to the new one.
2. Optional: in the repo's **Settings → Pages**, set a permanent
   redirect via `_config.yml` or simply leave GH Pages running as a
   fallback so old share links keep resolving. (Both URLs serve the
   same content from `main`, so this is mostly cosmetic.)

---

## Troubleshooting

- **Hostinger says "Value must be valid IPv4 address":** the **Type**
  is set to `A`. `A` records only accept IPv4 (e.g. `203.0.113.10`),
  not hostnames. Switch **Type** to **CNAME** — then the hostname
  target is accepted.
- **You typed a `*.workers.dev` target and the domain doesn't serve
  the site (even after switching to CNAME):** Cloudflare **Workers**
  do not respond to external custom hostnames just because DNS points
  at them. The Worker has to be told about the hostname, and that
  requires the zone to be on Cloudflare (Workers Custom Domain or
  Workers Route). From an external registrar like Hostinger, the
  supported path is **Cloudflare Pages**, whose `*.pages.dev` targets
  *do* accept external CNAMEs. If the frontend is currently on a
  Worker, deploy it to a Pages project (Step 1) and CNAME to the
  `*.pages.dev` target instead. Alternative: move the `almaintel.com`
  nameservers to Cloudflare (see "Optional: consolidate later") and
  attach a Workers Custom Domain — bigger blast radius, only worth
  it if you want everything on one origin.
- **DNS not resolving after 30 min:** double-check that the Hostinger
  CNAME is on the `almaintel.com` zone (not `www.almaintel.com` or
  another subdomain). Re-check the **Name** field — it should be just
  `2028ballot`, not `2028ballot.almaintel.com.` (which would expand to
  `2028ballot.almaintel.com.almaintel.com`).
- **"DNS validation failed" in Cloudflare Pages:** delete the custom
  domain in CF, wait 2 minutes, re-add. CF sometimes caches the
  pre-CNAME state.
- **SSL pending forever:** make sure no `AAAA` record exists for
  `2028ballot` at Hostinger; only the CNAME.
- **CORS errors from the frontend → Worker:** confirm the production
  domain spelling in `api/src/index.ts` `ALLOWED_ORIGINS` matches the
  one in the browser address bar exactly (scheme + host, no path).

---

## Optional: consolidate later (move nameservers to Cloudflare)

If you decide you want **one origin** (`api/*` and the site on the
same hostname, no CORS), the path is:

1. Add `almaintel.com` as a site in the Cloudflare dashboard
   (**Add a Site**). Cloudflare scans your existing Hostinger DNS
   records and stages them inside CF.
2. CF gives you two replacement nameservers
   (`xxx.ns.cloudflare.com` + `yyy.ns.cloudflare.com`).
3. At Hostinger, change the **Nameservers** for `almaintel.com` to
   the two CF nameservers.
4. Within a few hours, the zone is fully on Cloudflare. All your
   existing records (mail, etc.) keep working from CF.
5. In `api/wrangler.toml`, swap the workers.dev URL for a route:
   ```toml
   routes = [
     { pattern = "2028ballot.almaintel.com/api/*", zone_name = "almaintel.com" },
   ]
   ```
6. Redeploy the Worker. `/api/*` now serves from the same hostname as
   the frontend. Drop the CORS allow-list since same-origin requests
   skip the preflight.

Don't do this in a rush — verify in CF that the staged DNS records
match what Hostinger currently serves (especially mail / MX records)
before flipping the nameservers.
