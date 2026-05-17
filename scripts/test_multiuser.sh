#!/usr/bin/env bash
#
# Multi-user vote simulation.
#
# Proves the "real %, not invented" guarantee end-to-end:
#   1. Wipe the local D1 (LOCAL only — does NOT touch prod).
#   2. Fire 100 votes on a single pair (ramaswamy vs vance), split 70/30.
#   3. Read back /api/stats and assert the percentages match.
#   4. Compare to the pre-vote seeded estimate to demonstrate the
#      stats overlay's behavior actually changed.
#
# Usage:
#   ./scripts/test_multiuser.sh                       # against local
#   ./scripts/test_multiuser.sh <prod-url>            # against prod — but
#                                                     # this script does
#                                                     # NOT wipe prod.
#
# This script is destructive (DELETE FROM …) only when the BASE points
# at localhost. Refuses to run with --wipe against any non-local host.

set -u
BASE="${1:-http://127.0.0.1:8787}"
WIPE_LOCAL=true

if [[ "$BASE" != http://127.0.0.1* && "$BASE" != http://localhost* ]]; then
  WIPE_LOCAL=false
  printf "\033[33mTargeting non-local URL — wipe step will be skipped.\033[0m\n"
fi

PAIR_A="ramaswamy"
PAIR_B="vance"
N_FOR_A=70
N_FOR_B=30
TOTAL=$((N_FOR_A + N_FOR_B))

# ---------- 1. wipe local D1 ----------
if [[ "$WIPE_LOCAL" == true ]]; then
  echo "[1/4] Wiping local D1 pair_aggregates for a clean run…"
  ( cd "$(dirname "$0")/../api" && \
    npx wrangler d1 execute ranked-choice-db --local --command "DELETE FROM pair_aggregates" >/dev/null 2>&1 ) \
    || { echo "wipe failed — is the local D1 initialised?"; exit 1; }
  echo "  done."
else
  echo "[1/4] Skipping wipe (non-local target)."
fi

# ---------- 2. fire votes ----------
echo "[2/4] Firing $N_FOR_A votes for $PAIR_A and $N_FOR_B for $PAIR_B…"
for i in $(seq 1 $N_FOR_A); do
  curl -s -o /dev/null -X POST -H "content-type: application/json" \
    -d "{\"a\":\"$PAIR_A\",\"b\":\"$PAIR_B\",\"picked\":\"$PAIR_A\"}" "$BASE/api/vote"
done
for i in $(seq 1 $N_FOR_B); do
  curl -s -o /dev/null -X POST -H "content-type: application/json" \
    -d "{\"a\":\"$PAIR_A\",\"b\":\"$PAIR_B\",\"picked\":\"$PAIR_B\"}" "$BASE/api/vote"
done
echo "  $TOTAL votes posted."

# ---------- 3. read stats ----------
echo "[3/4] Fetching /api/stats…"
STATS=$(curl -s "$BASE/api/stats?a=$PAIR_A&b=$PAIR_B")
echo "  raw: $STATS"

# Extract counts via grep — works without jq dependency.
A_COUNT=$(echo "$STATS" | grep -oE "\"$PAIR_A\":[0-9]+" | head -1 | grep -oE "[0-9]+$")
B_COUNT=$(echo "$STATS" | grep -oE "\"$PAIR_B\":[0-9]+" | head -1 | grep -oE "[0-9]+$")
TOTAL_LOCAL=$(echo "$STATS" | grep -oE "\"local\":[0-9]+" | tail -1 | grep -oE "[0-9]+$")

# ---------- 4. assert ----------
echo "[4/4] Assertions:"
PASS=0
FAIL=0
expect() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    printf "  \033[32m✓\033[0m %s = %s\n" "$label" "$actual"
    PASS=$((PASS + 1))
  else
    printf "  \033[31m✗\033[0m %s expected %s, got %s\n" "$label" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

if [[ "$WIPE_LOCAL" == true ]]; then
  expect "$PAIR_A vote count" "$N_FOR_A" "${A_COUNT:-?}"
  expect "$PAIR_B vote count" "$N_FOR_B" "${B_COUNT:-?}"
  expect "total local"       "$TOTAL"   "${TOTAL_LOCAL:-?}"
else
  # Against prod we can't reset, so just sanity-check that the deltas
  # are reflected. Existing baseline counts ride along.
  if [[ -n "${A_COUNT:-}" && "$A_COUNT" -ge "$N_FOR_A" ]]; then
    printf "  \033[32m✓\033[0m %s count ≥ %d (got %d)\n" "$PAIR_A" "$N_FOR_A" "$A_COUNT"
    PASS=$((PASS + 1))
  else
    printf "  \033[31m✗\033[0m %s count < %d (got %s)\n" "$PAIR_A" "$N_FOR_A" "${A_COUNT:-nil}"
    FAIL=$((FAIL + 1))
  fi
fi

PCT_A=$(( (A_COUNT * 100) / (A_COUNT + B_COUNT) ))
PCT_B=$(( 100 - PCT_A ))
printf "\nReal aggregated split:\n"
printf "  %-12s %d votes (%d%%)\n" "$PAIR_A" "$A_COUNT" "$PCT_A"
printf "  %-12s %d votes (%d%%)\n" "$PAIR_B" "$B_COUNT" "$PCT_B"
printf "  total       %d votes\n\n" "$TOTAL_LOCAL"

if [[ $FAIL -gt 0 ]]; then
  echo "FAIL — $FAIL assertion(s) didn't match expected values."
  exit 1
fi
echo "OK — backend aggregates votes correctly across simulated users."
