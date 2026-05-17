#!/usr/bin/env bash
#
# Smoke test: T2/T3 votes flow to the backend after the honest-vote-reveal
# change (the prior Tier-1 gate is removed). POSTs a T2 vote, then checks
# /api/elo?country=GLOBAL — the candidate may not appear yet if it's
# below the 10-vote floor; we document the floor behavior either way.
#
# Usage:
#   ./scripts/check-tier-vote-flow.sh                                              # local wrangler dev
#   ./scripts/check-tier-vote-flow.sh https://ranked-choice-api.YOUR.workers.dev   # prod
#
# Exits 0 if every check passes, 1 otherwise.

set -u
BASE="${1:-http://127.0.0.1:8787}"

# Tier-2 candidates (per candidates.js tier assignment in
# smart-matchups-crowd-elo): ramaswamy, scott, ossoff, cuban, ...
A="${A:-ramaswamy}"
B="${B:-ossoff}"
PICKED="${PICKED:-ramaswamy}"

pass=0
fail=0
fail_list=()

ok() { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass + 1)); }
ng() { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail + 1)); fail_list+=("$1"); }

printf "\n\033[1m== POST %s/api/vote {a:%s, b:%s, picked:%s} ==\033[0m\n" "$BASE" "$A" "$B" "$PICKED"

POST=$(curl -sS -w $'\n%{http_code}' -X POST "$BASE/api/vote" \
  -H 'content-type: application/json' \
  -d "{\"a\":\"$A\",\"b\":\"$B\",\"picked\":\"$PICKED\"}") || { echo "curl failed"; exit 1; }
PSTATUS=$(tail -n1 <<<"$POST")
[[ "$PSTATUS" == "204" ]] && ok "T2 vote → 204 (accepted)" || ng "T2 vote expected 204, got $PSTATUS"

printf "\n\033[1m== GET %s/api/elo?country=GLOBAL ==\033[0m\n" "$BASE"

R=$(curl -sS -w $'\n%{http_code}' "$BASE/api/elo?country=GLOBAL") || { echo "curl failed"; exit 1; }
STATUS=$(tail -n1 <<<"$R")
BODY=$(sed '$d' <<<"$R")
[[ "$STATUS" == "200" ]] && ok "leaderboard HTTP 200" || ng "leaderboard expected 200, got $STATUS"

if command -v jq >/dev/null 2>&1; then
  COUNT=$(jq 'length' <<<"$BODY")
  ok "leaderboard returned $COUNT row(s) (10-vote floor enforced)"

  # If any row exists, assert every n_ballots >= 10 (10-vote floor).
  if (( COUNT > 0 )); then
    MIN=$(jq '[.[].n_ballots] | min' <<<"$BODY")
    if (( MIN >= 10 )); then ok "every leaderboard row has n_ballots >= 10 (min=$MIN)"; else ng "found row with n_ballots < 10 (min=$MIN)"; fi
  fi

  PRESENT=$(jq -r --arg id "$PICKED" '[.[] | select(.id == $id)] | length' <<<"$BODY")
  if (( PRESENT > 0 )); then
    ok "$PICKED appears in leaderboard (above 10-vote floor)"
  else
    printf "  \033[33m!\033[0m %s absent from leaderboard — below 10-vote floor (expected for fresh deploys).\n" "$PICKED"
  fi
else
  printf "  \033[33m!\033[0m jq not installed; skipping detailed leaderboard assertions.\n"
fi

printf "\n\033[1mResult:\033[0m %d pass / %d fail\n" "$pass" "$fail"
if (( fail > 0 )); then
  for f in "${fail_list[@]}"; do printf "  - %s\n" "$f"; done
  exit 1
fi
exit 0
