# The 2028 Ballot

A tiny mobile-first webapp that walks you through 25 head-to-head matchups
between possible 2028 presidential candidates, then produces a ranked-choice
top 5 you can share like a Wordle score.

## Run it

It's a static site — open `index.html` in a browser, or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

No build step, no dependencies.

## How it works

- `candidates.js` — the 25-candidate roster. Edit names/roles/bios freely.
- `app.js` — generates a matchup schedule (each candidate appears twice),
  runs Elo-style updates after each pick to produce a full ranking, and
  builds the shareable summary.
- `styles.css` — handcrafted CSS with light/dark mode and no framework.

The "what other voters chose" overlay shown after each vote is a
deterministic, hash-seeded estimate computed in the browser — there is no
backend. To make it live, swap `fetchPairStats()` in `app.js` for a real
endpoint.

## Sharing

Copy-to-clipboard produces a Wordle-shaped summary plus a deep link that
encodes the picks (`?b=ramaswamy,buttigieg,...`). Opening that link shows
the friend's ballot above the "start voting" CTA so the recipient can
build their own and compare.

## Keyboard

- `1` / `←` — pick the left candidate
- `2` / `→` — pick the right candidate
- `Space` / `Enter` — skip the matchup
