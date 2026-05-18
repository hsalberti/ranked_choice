# Roadmap

Phased plan from the current static prototype to a country-aware
production site. Each phase is independently shippable — we can stop
at any boundary and still have a working product.

## Phase 0 — Static prototype [done — 2026-05-16]

- Vanilla HTML/CSS/JS at the repo root.
- 25 candidates, Elo-style ranking, Wordle-shaped share text.
- Stats overlay was seeded by a deterministic hash — retired in v2.1 (see "Honest vote reveal" below) in favor of real `/api/stats` data with an explicit empty state when data is missing.
- Deep links via `?b=…` URL parameter.
- Light + dark mode, keyboard navigation, mobile-first layout.

**Known gaps:** ~~stats are simulated~~ *(addressed in v2.1)*, no persistence across devices, no
country awareness *(addressed in v2)*, no abuse protection *(addressed in v1.5)*.

## Phase 0.5 — Extended ranking pool + public launch [done — 2026-05-16]

Goal: ship a public URL **today** with an opt-in second round for
politically-inclined users.

- Add `EXTENDED_CANDIDATES` to `candidates.js` (~15 names sourced from
  `research/nyt-2028-candidates.md`: e.g. JB Pritzker, Sarah Huckabee
  Sanders, Greg Abbott, Brian Kemp, Glenn Youngkin, Doug Burgum, Tulsi
  Gabbard, Rand Paul, Mark Kelly, Chris Van Hollen, Stephen A. Smith,
  Donald Trump Jr., Rahm Emanuel, Gina Raimondo, Mitch Landrieu).
- Results screen gains a "Keep ranking — N more candidates" CTA.
- Opt-in flow runs pairwise matchups within the extended pool (each
  candidate appears ~twice). Result is a ranked list appended below
  the headline top-5.
- Share artifact: Wordle-shape top-5 above the fold; compact ranked
  extended list below (no emoji grid for the long tail).
- Deep links: `?b=top5,…&x=ext1,ext2,…` encodes both pools. Missing
  `x=` means the friend stopped at top-5.
- localStorage persists both rankings.
- Enable GitHub Pages on `main` → `https://hsalberti.github.io/ranked_choice/`.

**Exit criteria:** public URL is live; "keep ranking" CTA runs the
extended pool end-to-end on mobile; share text and deep link include
both lists.

## Phase 1 — Cloudflare plumbing (migrate off GH Pages) [done — partial — 2026-05-17, /api scaffold + Workers + D1 migrations + CI workflow + custom-domain doc shipped; user runs wrangler login + d1 create to flip on]

Goal: get a real backend in place without changing visible behavior.
URL moves to the Cloudflare-hosted custom domain at the end.

- Restructure repo into `/web`, `/api`, `/migrations`, `/specs`.
- Create Cloudflare Pages project pointed at `/web` on `main`.
- Create Workers project under `/api` with `wrangler.toml`.
- Provision D1 database, register binding in `wrangler.toml`.
- GitHub Action: deploy `/web` to Pages and `/api` to Workers on push
  to `main`.
- `GET /api/health` returns `{ ok: true, country: request.cf.country }`.
- Redirect GitHub Pages URL → Cloudflare URL once the new domain is live.

**Exit criteria:** custom domain serves the existing frontend, and
`/api/health` returns the visitor's country from any device.

**Follow-up (open):** the frontend was first deployed via `wrangler
deploy`, so it currently lives on a Worker
(`ranked-choice.alberti-rick.workers.dev`). An external Hostinger
CNAME cannot bind a custom domain to a `*.workers.dev` URL — Workers
custom hostnames require the zone to be on Cloudflare. Action: create
a separate Cloudflare **Pages** project for the static frontend, get
the `*.pages.dev` target, then CNAME `2028ballot.almaintel.com` to it
at Hostinger (see `website_instructions.md` Steps 1–3 and the
matching Troubleshooting entry). Keep the Worker for `/api/*` only.

## Phase 1.5 — Candidate detail cards & engagement tracking [done — partial — 2026-05-17, frontend live on prod, backend complete locally; prod deploy pending wrangler login]

Goal: each candidate card has a front (punchy hook) + a back (factual
detail) that the visitor can open, with click tracking on outbound
links for editorial signal.

**Frontend (ships independently of any backend).**

- Extend `candidates.js`: add `hook`, `bio_long`, `storyline`, `policy[]`,
  `moment`, and `links: { twitter, wikipedia }` per candidate. Remove
  the old `bio` field. Apply to both headline and extended pools.
- CSS 3D card flip on the matchup card (`perspective` + `preserve-3d` +
  `backface-visibility`). Honor `prefers-reduced-motion`.
- Two faces: front (avatar, name, role, party chip, hook, tap-more hint,
  ⓘ button) and back (bio, storyline, policy bullets, moment/quote,
  Twitter + Wikipedia link buttons, ← Back).
- Click scoping: while flipped, the card is read-only — voting requires
  flipping back first. Keyboard shortcuts (1/2/←/→) auto-unflip before
  voting.
- Results screen: tap any rank-row to open a bottom-sheet using the
  same back-card content (`backHtml(c)` shared helper).
- Client-side `track(event_type, candidate_id, context)` queues events
  to `localStorage`. Events: `flip_open`, `flip_close`, `link_twitter`,
  `link_wikipedia`. Context is `'matchup'` or `'results'`. Flush is
  feature-flagged off via `EVENT_FLUSH_URL = null` until the backend
  ships.

**Backend (gated on Phase 1 plumbing).**

- D1 migration: `candidate_events` table (see `tech-stack.md`).
- `POST /api/event`: validates a batch of `{ candidate_id, event_type,
  context }`, derives `country` from `request.cf.country`, increments
  the per-day aggregate. Returns `204`.
- Frontend: set `EVENT_FLUSH_URL` to the live endpoint. Queue drains.
- Admin: `wrangler d1 execute` query recipes in the README — top
  candidates by Twitter clicks last 7 days, per-country interest, etc.

**Exit criteria:** card flips smoothly on mobile, voting is never
accidentally triggered from the back face, link buttons open in a new
tab, and (once the backend ships) D1 counts increment within a few
seconds of a click.

## Phase 2 — Vote ingestion + country-filtered overlay [done — partial — 2026-05-17, backend complete locally; prod deploy pending wrangler login]

Goal: the stats overlay shows real, country-aware numbers.

- D1 migration: `pair_aggregates` table.
- `POST /api/vote`: validate `{ a, b, picked }`, derive `pair_key`,
  increment counter for `(pair_key, country, picked)`.
- `GET /api/stats?a=X&b=Y`: read local (country) and global counts.
- Frontend: replace `fetchPairStats()` with a real `fetch` call.
  Fall back to the seeded estimate on network error so the UX never
  hangs.
- Update stats overlay copy: "In Brazil, 62% picked X. Globally, 55%."
- Add a small "based on N votes in your country" footer.

**Exit criteria:** voting on phone A makes the percentage move on
phone B (same country) within five seconds.

## Phase 3 — Ballot submission + country leaderboard [done — partial — 2026-05-17, backend complete locally; prod deploy pending wrangler login]

Goal: country-level top-5 visible at the results screen.

- D1 migrations: `ballots`, `candidate_country_score`.
- `POST /api/ballot`: persist the top-5 (and optional `extended`
  ranking), update Borda scores in `candidate_country_score`. Only
  the top-5 feeds Borda; the extended list is stored but not scored.
- `GET /api/leaderboard/:country`: top-5 candidates by weighted score.
- `GET /api/ballot/:id`: fetch a shared ballot by ID.
- Frontend: after results render, fetch "Top 5 in {country}" and
  render it in a panel below the user's top-5.
- Switch share links from `?b=ids&x=ids` to `?b={ballot_id}` so the
  picks live server-side.

**Exit criteria:** finishing a ballot triggers a `/api/ballot` POST,
and the country leaderboard updates within a few seconds and matches
the count returned from D1.

## Phase 4 — Ballot-vs-country comparison [done — partial — 2026-05-17, backend complete locally; prod deploy pending wrangler login]

Goal: surface how a user agrees and disagrees with their country.

- `GET /api/comparison/:country`: country's top-5 with their per-rank
  score share.
- Frontend: side-by-side "You vs. {country}" panel on the results
  screen, highlighting overlaps (same name in both lists) and
  contrasts (in your top-5, not theirs).
- Extend the share preview to include a one-line "agree with
  {country}: 3/5" stat.

**Exit criteria:** comparison panel renders within 500ms after the
results screen mounts, and the totals match what `/api/leaderboard`
returns.

## Phase 5 — Anti-abuse hardening [done — partial — 2026-05-17, server-side gate complete, KV namespace + Turnstile site key still pending CF dashboard work]

Goal: make casual scripted abuse unprofitable.

- Integrate Turnstile (invisible mode) on `/api/vote`, `/api/ballot`,
  and `/api/event`.
- Workers KV rate limiter: 50 votes / 10 ballots / 200 events per IP
  per day, keyed by `sha256(ip + DAILY_SALT)`.
- Server-side validation: candidate IDs against the canonical list,
  ballot length exactly 5, no duplicate picks, country length 2.
- Admin endpoint behind Cloudflare Access for a moderation dashboard
  (vote totals, suspect IPs by hash, top countries).
- Document the threat model and known limitations in
  `/specs/security.md`.

**Exit criteria:** a scripted attack hitting `/api/vote` is throttled
within 50 requests and fails Turnstile on hit 51; admin dashboard
loads behind Access.

## Phase 6 — Polish + observability [done — partial — 2026-05-17, OG image endpoint + CI smoke test ready; Web Analytics + Lighthouse CI still need user-side enablement]

Goal: production-grade readiness without scope creep.

- Cloudflare Web Analytics installed on Pages.
- Logpush from Workers → R2 with a 7-day retention.
- Lighthouse audit, target 95+ across all four categories on mobile.
- Open Graph image generator (Workers `og:image` endpoint) so shared
  links preview a stylized ballot card.
- Smoke-test E2E script in CI hitting `/api/health`, `/api/stats`,
  `/api/vote`, `/api/ballot`, `/api/event` against a preview environment.
- Set up alerting (e.g. Slack webhook) when 5xx rate or KV write
  failures exceed thresholds.

**Exit criteria:** Lighthouse 95+ across the board, error budget green
for a full week, OG previews render on share.

## v2 — Smart matchups + Crowd ELO [in progress — 2026-05-17]

Driven by the OpenSpec change `smart-matchups-crowd-elo`
(`openspec/changes/smart-matchups-crowd-elo/`). Sharpens the matchup
algorithm, restructures the roster into three opt-in tiers, refocuses
the results screen on the personal ballot, and exposes a country-aware
crowd ELO explorer.

- **Tiered roster (15 / 12 / 13).** Headline shrinks to a Tier-1 top
  cohort (15 names; `trumpjr` and `pritzker` promoted from extended).
  Tier 2 (12) and Tier 3 (13) become "Keep voting" and "Go deeper"
  opt-in waves. ELO carries forward across tiers.
- **Smart matchup engine.** R1 fixed (Vance vs. Newsom). R2 hand-picked
  rival (`vance → rubio`, `newsom → aoc`). R3+ adaptive (70%
  close-rated, 30% random) with a coverage floor. Glicko-2 with a
  10-vote floor / 18-vote cap in Tier 1.
- **Crowd ELO backend.** New D1 table `candidate_country_elo`,
  incremental Glicko-2 in `POST /api/vote`, new `GET /api/elo`
  endpoint with country + party filters and min-N gating (`ELO_MIN_N`
  env var, default 20).
- **Stats screen.** New `#screen-stats` reachable only from the
  results screen. Filter chips for country and party; row → existing
  detail sheet.
- **Refocused results screen.** Top-5 + Wordle-shape grid + Copy /
  Post-to-X / native-share buttons + "See global stats →" CTA +
  tier-progression CTA. Country leaderboard, you-vs-country comparison,
  and full-ranking toggle move off-page (functions retained for the
  stats screen).

**Exit criteria:** roster reshuffle live; median Tier-1 session ≤ 18
votes; `/api/elo` returns country-aware leaderboards under 100ms p95;
stats screen renders without `country_leaderboard` / `country_comparison`
calls in the results path.

## v3 — Tier list + civic explainer [in progress — 2026-05-17]

Driven by the OpenSpec change `tier-list-view`
(`openspec/changes/tier-list-view/`). Aims at the streamer / creator
cohort: gives them a TierMaker-style visual artifact to react to once
their personal ballot is in, and uses the moment to surface a plain-
English explainer of how the math works and what ranked-choice voting
actually is.

- **Tier-list view.** TierMaker-style S/A/B/C rows (plus D and F at
  larger roster sizes) rendered from either Global crowd Elo or this
  session's personal Glicko ratings. Tier cuts are fixed-count by
  position (15 → 2/3/4/6; 25 → 2/3/5/7/8; 40 → 2/3/5/7/8/15) so two
  viewers at the same size + source see identical groupings.
- **Two entry points, one component.** Inline below `#screen-results`
  (lazy-mounted via IntersectionObserver), and a dedicated
  `#screen-tiers` screen reachable at hash route `#/tiers`. Same
  `renderTierList()` powers both hosts.
- **Header controls.** Roster-size pills (15 / 25 / 40), source pills
  (Global / Mine), and "How?" + "Save as image" buttons. Mine is gated
  behind 5 in-session votes; selections persist in `localStorage`.
- **PNG export.** Client-side 1200×630 canvas render with a small
  `2028ballot.almaintel.com` watermark; filename
  `2028ballot-tier-{global|mine}-{15|25|40}.png`. No Worker round-trip,
  no extra runtime deps.
- **Civic explainer panel.** Two anchored sections (`#how-elo`,
  `#why-rcv`) reachable from the tier-list header ("How?") and from an
  `(i)` icon next to "Your top 5" on the results screen. Copy is
  neutral / explanatory and lives as single string constants in
  `app.js` so edits don't touch markup.

**Exit criteria:** inline tier-list renders below the results screen
without a Lighthouse regression; `#/tiers` deep-links land on the
standalone screen; PNG export downloads a valid 1200×630 image in
Chrome / Safari / Firefox; explainer panel opens to either section
without scrolling glitches.

## v2.1 — Honest vote reveal [in progress — 2026-05-17]

Goal: retire the seeded-fake `fetchPairStats()` from Phase 0 and turn
the post-vote moment into a first-class data surface. The vote-flow
overlay was always going to be the highest-engagement surface on the
site; v2.1 is the cleanup that makes it deliver real data instead of
plausible-looking fabricated numbers, and that puts the candidate's
actual ELO + rank on the card the user just picked.

- **Floating overlay deleted.** `#stat-overlay`, `showStatOverlay`,
  `fetchPairStats`, `loadLocalVotes`/`saveLocalVote`/`undoLocalVote`,
  the `STORAGE_LOCAL_VOTES` localStorage key, and the tap-overlay
  click handler all removed. No flag, no transition period.
- **In-card reveal.** The winning card's chrome tints to its party
  color (`party-D` blue / `party-R` red / `party-I` neutral) while
  the portrait stays at full saturation. The losing card dims to ~50%
  opacity. A `.reveal-panel` below the existing card content shows
  two data lines: `${elo} ELO · Rank #N` (or `· UNRANKED` if below
  the 10-vote floor) and `Won against ${opponent} ${pct}% of ${N}
  votes` (or `Early matchup — N votes so far` if pair has < 10
  votes in scope).
- **Real-data-only contract.** If `/api/stats` fails or
  `API_REACHABLE === false`, the reveal still tints + dims but the
  data lines stay empty. No fabrication, no fallback to seeded data.
- **Extended `/api/stats`.** Response gains `elo: { [a], [b] }`,
  `rank: { [a], [b] }`, and `scope: "GLOBAL"|<ISO2>`. Rank is the
  candidate's 1-indexed global position among all candidates with
  `SUM(n_ballots) >= 10`; below the floor it returns `null`. Scope
  reflects whether the visitor's country has crossed a 10,000-vote
  activation threshold; below that, GLOBAL is the displayed dataset.
- **10-vote leaderboard floor.** `GET /api/elo?country=GLOBAL` now
  enforces `n_ballots >= 10`; below-floor candidates are excluded
  from leaderboard and rank computations.
- **All-tier votes hit the backend.** The prior Tier-1-only gate on
  `postRemoteVote()` is dropped — Tier 2/3 votes also contribute to
  global ELO and pair_aggregates. The 10-vote floor protects against
  noise from rarely-seen pairs.
- **Sound layer.** New `lib/sounds.js` exposes `Sounds.pickClick()`
  and `Sounds.resolvedChime()` synthesized via WebAudio (zero asset
  payload). Mute toggle in the topbar persists to
  `ballot28.muted.v1`; default is unmuted.

**Exit criteria:** `./scripts/check-stats-elo.sh` and
`./scripts/check-elo-floor.sh` both pass against the deployed Worker;
manual smoke confirms the reveal renders party tint + ELO + rank +
pair line on Tier 1/2/3 votes; sound plays once per vote; mute toggle
persists across reloads; offline mode still renders the visual reveal
without data lines.

## v4 — Login & saved preferences [proposed — 2026-05-18]

Goal: give returning visitors a way to resume their ballot across devices
and across days, so the Rank More / Keep Calibrating CTAs (shipped local-
only in the same week) can persist Elo state instead of losing it on every
reload.

Status today: anonymous-only. Each browser keeps Glicko-2 ratings in
memory; closing the tab discards them. The post-results screen offers
**Rank More Candidates** (advance to the next tier) and **Keep Calibrating
Preferences** (extend the current tier's vote cap and continue sharpening
Elo), both of which currently operate purely on in-memory state. A signed-
in flow would unlock returning sessions, cross-device sync, and a
"resume where you left off" entry point.

**Open tradeoffs to resolve before implementing:**

- **Auth provider.** Magic-link email (own infra, low friction, slow
  first-hop), OAuth via GitHub/Google/Apple (fast, identifies real people,
  third-party dependency), Cloudflare Access (clean integration with the
  rest of the stack, requires zone migration to CF DNS — see Phase 1
  follow-up), Passkeys (modern, but split UX on older devices). No
  obvious default; depends on whether the audience is technical or
  general-public.
- **Anonymity vs persistence.** The current README and roadmap
  principle is "Anonymous stays the default." Login must be *opt-in* and
  never gate any existing functionality. Decide whether anonymous local
  ballots get migrated into the signed-in account on first login, or
  treated as separate sessions.
- **Server-side state shape.** Today `candidate_country_elo` is a
  pool-wide aggregate; per-user state needs a new D1 table (`user_state`?
  `user_ratings`?) keyed by `(user_id, candidate_id, tier)` storing
  Glicko-2 `rating / rd / sigma / appearances`. Watch the row-count
  blow-up: 40 candidates × every signed-in user. Consider blob-JSON-per-
  user instead of one row per (user × candidate).
- **Multi-device merge semantics.** If a user votes on phone, then opens
  the app on laptop, do we replay events in order, take the more recent
  state, or surface a "we see two diverged sessions, pick one" UX? Cheap
  v1 = last-write-wins on a single state blob.
- **Migration of anonymous ballots.** A user who voted anonymously, then
  signs up — do we import their session, or start fresh? Importing is
  friendly but creates a vector for ballot stuffing (sign up, anon-vote
  10×, sign up again). Decide before shipping the login button.
- **What the two CTAs do once persistence exists.** Rank More across
  devices clearly works as additive expansion. Keep Calibrating across
  devices is murkier — should the cap reset on each new session, or carry
  forward forever? If forever, the CI early-exit eventually fires and
  the button becomes a no-op; need new UX copy for that state.

**Likely deliverables (when picked up):**

- Login surface (button in the topbar; modal sheet on mobile).
- `user_state` D1 table + `GET /api/me/state` + `POST /api/me/vote`
  endpoints.
- Authenticated session cookie scoped to the API origin (same-site
  considerations given the Pages+Workers split).
- Rank More / Keep Calibrating wired to persist server-side when signed
  in, fall back to local-only when anonymous.
- Returning-visitor entry on the start screen: "Welcome back —
  N candidates ranked. Resume?"

## Phase 7 — Beyond MVP

Picked up only when there's demand signal from real usage.

- **Time windowing** — toggle aggregates between "this week" and "all
  time"; needs an extra date-bucket dimension in `pair_aggregates`.
- **Optional sign-in** — *promoted into its own roadmap item; see "v4 —
  Login & saved preferences" above.*
- **Party-of-voter filter** — opt-in self-report, sliced into
  aggregates as a third dimension after country.
- **Embed widget** — `<script src=…>` that drops a one-matchup card
  on a publisher's article and links back to the full ballot.
- **Retrospective ballots** — past-cycle versions (2024, 2020) using
  the same engine for nostalgia + new-user funnel.
- **Multi-language** — Spanish + Portuguese first, since the country
  filter will surface non-US traffic quickly.

## Cross-cutting principles for every phase

- **Country filter is the headline.** Any UI surface that shows
  aggregate stats should expose country alongside global.
- **Anonymous stays the default.** Adding accounts is a future
  feature, never a gate.
- **No third-party trackers ever.** New analytics must be cookieless
  and first-party.
- **Free tier first.** Don't introduce a paid dependency without
  evidence it's needed at our current scale.
- **Roster is frozen.** The headline 25 and extended ~15 are locked
  at v1 launch. Any change after that is a spec amendment, not a
  content update.
