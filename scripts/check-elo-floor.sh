#!/usr/bin/env bash
#
# Smoke test: /api/elo?country=GLOBAL enforces the 10-vote floor.
# Every returned row must have n_ballots >= 10.
#
# Usage:
#   ./scripts/check-elo-floor.sh                                              # local wrangler dev
#   ./scripts/check-elo-floor.sh https://ranked-choice-api.YOUR.workers.dev   # prod

set -u
BASE="${1:-http://127.0.0.1:8787}"

pass=0
fail=0
fail_list=()

ok() { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass + 1)); }
ng() { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail + 1)); fail_list+=("$1"); }

printf "\n\033[1m== GET %s/api/elo?country=GLOBAL ==\033[0m\n" "$BASE"

R=$(curl -sS -w $'\n%{http_code}' "$BASE/api/elo?country=GLOBAL") || { echo "curl failed"; exit 1; }
STATUS=$(tail -n1 <<<"$R")
BODY=$(sed '$d' <<<"$R")
[[ "$STATUS" == "200" ]] && ok "HTTP 200" || ng "expected 200, got $STATUS"

if ! command -v jq >/dev/null 2>&1; then
  printf "  \033[33m!\033[0m jq required for floor assertions. Skipping.\n"
  exit 0
fi

COUNT=$(jq 'length' <<<"$BODY")
if (( COUNT == 0 )); then
  printf "  \033[33m!\033[0m leaderboard empty — every candidate below 10-vote floor (expected on fresh deploys).\n"
  ok "empty array is valid response (cold start)"
else
  MIN=$(jq '[.[].n_ballots] | min' <<<"$BODY")
  if (( MIN >= 10 )); then
    ok "all $COUNT rows have n_ballots >= 10 (min=$MIN)"
  else
    ng "found row with n_ballots < 10 (min=$MIN)"
    jq '.[] | select(.n_ballots < 10)' <<<"$BODY"
  fi
fi

printf "\n\033[1mResult:\033[0m %d pass / %d fail\n" "$pass" "$fail"
if (( fail > 0 )); then
  for f in "${fail_list[@]}"; do printf "  - %s\n" "$f"; done
  exit 1
fi
exit 0
