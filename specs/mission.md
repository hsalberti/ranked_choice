# Mission

The 2028 Ballot is a snackable, politically-balanced webapp that lets
anyone build a personal ranked-choice presidential ballot in under two
minutes and share it like a Wordle score.

## What we're building

A toy ballot — not a poll, not a forecasting tool, not a campaign
platform. Visitors pairwise-compare 25 candidates from across the
American political spectrum, walk away with a personal top-5, and see
how their picks compare to other voters in their country. Politically
inclined users can opt into an **extended ranking** round that surfaces
~15 more candidates beyond the headline 25 and appends them below the
top-5.

## Audience

- Politically-curious people on either side of the U.S. partisan line.
- Friends sharing back-and-forth like Wordle scores.
- Anyone abroad watching the 2028 race who wants to register an opinion
  without signing up for anything.

## Principles

1. **Even-handed by default.** Visual neutrality (no party tilt in the
   chrome), balanced matchup generation, factual blurbs. Equal
   representation of D and R candidates in copy, ordering, and color
   weight.
2. **Snackable.** First matchup within one tap from landing. Full
   ballot in under two minutes. No sign-in friction in the happy path.
3. **Shareable like Wordle.** Wordle-shaped emoji summary as the
   default share artifact. Deep links surface a friend's ballot on
   landing so recipients can compare immediately.
4. **Anonymous, low-PII.** No accounts, no email, no demographic
   capture. Country is the only voter attribute we ever store, and it
   comes from the request header — not from user input.
5. **Polished aesthetic.** Apple/CNN-leaning: clean type, generous
   whitespace, light + dark mode, no chartjunk. The candidate photos
   carry the color — the chrome stays restrained.
6. **Free to use, cheap to run.** Stay inside the chosen host's free
   tier until there is a measured reason not to.
7. **Roster is curated and frozen at launch.** The owner curates the
   25-name headline roster and the ~15-name extended pool, using the
   NYT's running roundup as one input among many. After v1 ships, the
   roster does not change — the artifact is meant to be a snapshot of
   the 2026 conversation, not a live tracker. <!-- inferred: "frozen at launch" reflects the user's "never refresh" answer; if a major news event makes a name untenable, treat that as a spec-amendment decision, not a routine update -->

## Non-goals

- **Not a scientific poll.** Aggregates are biased by who shares the
  app, not by who votes in real elections. Surface this honestly in
  copy.
- **Not a campaign platform.** No candidate gets surfaced ahead of
  another in chrome, copy, or matchup ordering.
- **Not a data collection product.** Beyond country (from IP) and
  vote contents, we collect nothing — no demographics, no email,
  no analytics that profile individuals.
- **Not a forecasting tool.** We don't model 2028 outcomes.
- **Not a live tracker.** The roster does not update with the news
  cycle; see principle 7.

## Success signals

In rough priority order:

1. Completion rate (visitor → finished top-5) above 60%.
2. Share rate (finishers → copied or native-shared) above 25%.
3. Friend-link conversion (arrived via `?b=` → completed own ballot)
   above 50%.
4. Median time-to-finish under 90 seconds.
5. Extended-ranking opt-in (finishers → opened the extended pool)
   above 10% — signal for whether the long tail is worth keeping.

Anything that erodes the snackable, neutral, anonymous character of the
product is a regression even if it lifts a number.
