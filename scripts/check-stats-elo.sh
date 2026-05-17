#!/usr/bin/env bash
#
# Smoke test for the extended /api/stats response shape.
# Verifies the new fields added by the honest-vote-reveal change:
#   elo:   { [a]: number|null, [b]: number|null }
#   rank:  { [a]: number|null, [b]: number|null }
#   scope: "GLOBAL" | <ISO2 country code>
#
# Usage:
#   ./scripts/check-stats-elo.sh                                              # local wrangler dev
#   ./scripts/check-stats-elo.sh https://ranked-choice-api.YOUR.workers.dev   # prod
#
# Exits 0 if every check passes, 1 otherwise.

set -u
BASE="${1:-http://127.0.0.1:8787}"
A="${A:-vance}"
B="${B:-newsom}"

pass=0
fail=0
fail_list=()

ok() { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass + 1)); }
ng() { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail + 1)); fail_list+=("$1"); }

printf "\n\033[1m== GET %s/api/stats?a=%s&b=%s ==\033[0m\n" "$BASE" "$A" "$B"

R=$(curl -sS -w $'\n%{http_code}' "$BASE/api/stats?a=$A&b=$B") || { echo "curl failed"; exit 1; }
STATUS=$(tail -n1 <<<"$R")
BODY=$(sed '$d' <<<"$R")

[[ "$STATUS" == "200" ]] && ok "HTTP 200" || ng "expected 200, got $STATUS"

# jq presence check — soft fail if not installed
if ! command -v jq >/dev/null 2>&1; then
  printf "  \033[33m!\033[0m jq not installed; falling back to grep checks.\n"
  grep -q '"elo"' <<<"$BODY"   && ok "response carries 'elo' key"   || ng "missing 'elo' key"
  grep -q '"rank"' <<<"$BODY"  && ok "response carries 'rank' key"  || ng "missing 'rank' key"
  grep -q '"scope"' <<<"$BODY" && ok "response carries 'scope' key" || ng "missing 'scope' key"
else
  # Type checks: elo[a]/elo[b] must be number or null; same for rank.
  if jq -e ".elo[\"$A\"]  | (type == \"number\" or . == null)" <<<"$BODY" >/dev/null; then ok "elo.$A is number|null"; else ng "elo.$A wrong type"; fi
  if jq -e ".elo[\"$B\"]  | (type == \"number\" or . == null)" <<<"$BODY" >/dev/null; then ok "elo.$B is number|null"; else ng "elo.$B wrong type"; fi
  if jq -e ".rank[\"$A\"] | (type == \"number\" or . == null)" <<<"$BODY" >/dev/null; then ok "rank.$A is number|null"; else ng "rank.$A wrong type"; fi
  if jq -e ".rank[\"$B\"] | (type == \"number\" or . == null)" <<<"$BODY" >/dev/null; then ok "rank.$B is number|null"; else ng "rank.$B wrong type"; fi
  SCOPE=$(jq -r '.scope' <<<"$BODY")
  if [[ "$SCOPE" == "GLOBAL" || "$SCOPE" =~ ^[A-Z]{2}$ ]]; then ok "scope is 'GLOBAL' or ISO-2 (got '$SCOPE')"; else ng "scope wrong shape (got '$SCOPE')"; fi
  # Preserved legacy fields:
  if jq -e ".local[\"$A\"]  | type == \"number\"" <<<"$BODY" >/dev/null; then ok "local.$A preserved"; else ng "local.$A missing/wrong type"; fi
  if jq -e ".global[\"$B\"] | type == \"number\"" <<<"$BODY" >/dev/null; then ok "global.$B preserved"; else ng "global.$B missing/wrong type"; fi
  # Print the response for human inspection.
  printf "\n  Response:\n"
  jq . <<<"$BODY" | sed 's/^/    /'
fi

printf "\n\033[1mResult:\033[0m %d pass / %d fail\n" "$pass" "$fail"
if (( fail > 0 )); then
  for f in "${fail_list[@]}"; do printf "  - %s\n" "$f"; done
  exit 1
fi
exit 0
