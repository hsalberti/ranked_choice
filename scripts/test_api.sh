#!/usr/bin/env bash
#
# Comprehensive backend smoke + correctness suite.
#
# Usage:
#   ./scripts/test_api.sh                                              # against local wrangler dev (http://127.0.0.1:8787)
#   ./scripts/test_api.sh https://ranked-choice-api.YOUR.workers.dev   # against prod
#
# Exits 0 if every check passes, 1 otherwise. Prints a summary at the
# end. Safe to re-run — checks are read-mostly, the few POSTs are
# clearly tagged so admin-side cleanup is easy.

set -u
BASE="${1:-http://127.0.0.1:8787}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
ORIGIN="${ORIGIN:-https://2028ballot.almaintel.com}"

pass=0
fail=0
fail_list=()

ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass + 1)); }
ng()   { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail + 1)); fail_list+=("$1"); }
hdr()  { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }

# Pull HTTP status and body separately.
fetch() {
  local body status
  body=$(curl -sS -w $'\n%{http_code}' "$@") || { echo "CURL_ERR\n0"; return; }
  printf '%s' "$body"
}
status_of() { tail -n1 <<<"$1"; }
body_of()   { sed '$d' <<<"$1"; }

# ---------- health ----------
hdr "Health"
R=$(fetch "$BASE/api/health")
[[ $(status_of "$R") == 200 ]] && ok "GET /api/health → 200" || ng "GET /api/health expected 200, got $(status_of "$R")"
grep -q '"country"' <<<"$(body_of "$R")" && ok "health response carries 'country' field" || ng "health response missing 'country'"

# ---------- CORS ----------
hdr "CORS"
HDR=$(curl -sS -i -X OPTIONS \
  -H "origin: $ORIGIN" \
  -H "access-control-request-method: POST" \
  "$BASE/api/vote" | tr -d '\r')
echo "$HDR" | grep -qE "^HTTP/.*204"             && ok "OPTIONS preflight → 204"             || ng "OPTIONS preflight not 204"
echo "$HDR" | grep -qiE "^access-control-allow-origin: $ORIGIN" && ok "allow-origin echoes prod origin" || ng "allow-origin missing/mismatched"

BAD=$(curl -sS -i -X OPTIONS \
  -H "origin: https://evil.example" \
  -H "access-control-request-method: POST" \
  "$BASE/api/vote" | tr -d '\r')
# Browser-secure when allow-origin is either absent OR empty: in both
# cases the browser rejects the cross-origin response. Workers strips
# headers with empty values, so we accept either shape.
ALLOW_LINE=$(echo "$BAD" | grep -i '^access-control-allow-origin:' | head -1)
if [[ -z "$ALLOW_LINE" ]] || echo "$ALLOW_LINE" | grep -qiE "^access-control-allow-origin:[[:space:]]*\$"; then
  ok "blocked origin: allow-origin absent or empty (CORS-secure)"
else
  ng "blocked origin DID get an allow-origin: $ALLOW_LINE"
fi

# ---------- /api/vote happy path + validation ----------
hdr "Vote"
R=$(fetch -X POST -H "origin: $ORIGIN" -H "content-type: application/json" \
  -d '{"a":"ramaswamy","b":"booker","picked":"booker"}' "$BASE/api/vote")
[[ $(status_of "$R") == 204 ]] && ok "POST /api/vote happy path → 204" || ng "POST /api/vote expected 204, got $(status_of "$R")"

for payload in '{"a":"fake","b":"booker","picked":"fake"}' \
               '{"a":"ramaswamy","b":"ramaswamy","picked":"ramaswamy"}' \
               '{"a":"ramaswamy","b":"booker","picked":"vance"}' \
               'not-json'; do
  R=$(fetch -X POST -H "origin: $ORIGIN" -H "content-type: application/json" \
    -d "$payload" "$BASE/api/vote")
  [[ $(status_of "$R") == 400 ]] && ok "POST /api/vote 400 on $(echo "$payload" | head -c 50)" \
    || ng "POST /api/vote should reject: $payload"
done

# ---------- /api/stats ----------
hdr "Stats"
R=$(fetch -H "origin: $ORIGIN" "$BASE/api/stats?a=ramaswamy&b=booker")
[[ $(status_of "$R") == 200 ]] && ok "GET /api/stats happy path → 200" || ng "stats expected 200, got $(status_of "$R")"

S=$(body_of "$R")
grep -q '"local"'    <<<"$S" && ok "stats has 'local' field"    || ng "stats missing local"
grep -q '"global"'   <<<"$S" && ok "stats has 'global' field"   || ng "stats missing global"
grep -q '"pair_key"' <<<"$S" && ok "stats has 'pair_key' field" || ng "stats missing pair_key"

R2=$(fetch -H "origin: $ORIGIN" "$BASE/api/stats?a=booker&b=ramaswamy")
KEY1=$(grep -oE '"pair_key":"[^"]+"' <<<"$S")
KEY2=$(grep -oE '"pair_key":"[^"]+"' <<<"$(body_of "$R2")")
[[ "$KEY1" == "$KEY2" ]] && ok "stats pair_key canonical (same for swapped a/b)" \
                          || ng "stats pair_key not canonical: $KEY1 vs $KEY2"

# ---------- /api/event ----------
hdr "Events"
R=$(fetch -X POST -H "origin: $ORIGIN" -H "content-type: application/json" \
  -d '{"events":[{"candidate_id":"ramaswamy","event_type":"flip_open","context":"matchup"}]}' \
  "$BASE/api/event")
[[ $(status_of "$R") == 204 ]] && ok "POST /api/event happy path → 204" || ng "events expected 204, got $(status_of "$R")"

R=$(fetch -X POST -H "origin: $ORIGIN" -H "content-type: application/json" \
  -d '{"events":[{"candidate_id":"FAKE","event_type":"flip_open","context":"matchup"}]}' "$BASE/api/event")
[[ $(status_of "$R") == 204 ]] && ok "POST /api/event silently drops bad candidate_id" \
                                 || ng "events should silently drop invalid id"

R=$(fetch -X POST -H "origin: $ORIGIN" -H "content-type: application/json" \
  -d '{}' "$BASE/api/event")
[[ $(status_of "$R") == 400 ]] && ok "POST /api/event missing events → 400" || ng "events should 400 with empty body"

# ---------- /api/ballot lifecycle ----------
hdr "Ballot lifecycle"
R=$(fetch -X POST -H "origin: $ORIGIN" -H "content-type: application/json" \
  -d '{"picks":["ramaswamy","booker","vance","aoc","newsom"]}' "$BASE/api/ballot")
[[ $(status_of "$R") == 200 ]] && ok "POST /api/ballot → 200" || ng "ballot expected 200, got $(status_of "$R")"
ID=$(grep -oE '"id":"[^"]+"' <<<"$(body_of "$R")" | head -1 | sed 's/"id":"//;s/"//')
[[ -n "$ID" ]] && ok "ballot returned an id ($ID)" || ng "ballot missing id"

# Validation cases. v2: pick-list accepts ALL_IDS (40), so extended-pool
# candidates like `pritzker` are now valid top-5 picks (replaced below
# by an outright invalid id to exercise the same code path).
for payload in '{"picks":["ramaswamy","booker"]}' \
               '{"picks":["ramaswamy","ramaswamy","vance","aoc","newsom"]}' \
               '{"picks":["NOTACAND","booker","vance","aoc","newsom"]}' \
               '{"picks":["ramaswamy","booker","vance","aoc","newsom"],"extended":["ramaswamy"]}'; do
  R=$(fetch -X POST -H "origin: $ORIGIN" -H "content-type: application/json" \
    -d "$payload" "$BASE/api/ballot")
  [[ $(status_of "$R") == 400 ]] && ok "POST /api/ballot 400 on $(echo "$payload" | head -c 60)" \
                                  || ng "ballot should reject: $payload"
done

if [[ -n "$ID" ]]; then
  R=$(fetch -H "origin: $ORIGIN" "$BASE/api/ballot/$ID")
  [[ $(status_of "$R") == 200 ]] && ok "GET /api/ballot/$ID round-trip → 200" \
                                  || ng "ballot get expected 200, got $(status_of "$R")"
  grep -q '"picks"' <<<"$(body_of "$R")" && ok "ballot fetch carries picks" \
                                          || ng "ballot fetch missing picks"

  # OG image
  OG_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/og/$ID")
  OG_TYPE=$(curl -sS -o /dev/null -w "%{content_type}" "$BASE/api/og/$ID")
  if [[ "$OG_CODE" == 200 ]]; then
    ok "GET /api/og/$ID → 200 (type: $OG_TYPE)"
  else
    ng "OG image expected 200, got HTTP $OG_CODE (type: $OG_TYPE)"
  fi
fi

# ---------- /api/leaderboard ----------
hdr "Leaderboards"
R=$(fetch -H "origin: $ORIGIN" "$BASE/api/leaderboard/BR")
[[ $(status_of "$R") == 200 ]] && ok "GET /api/leaderboard/BR → 200" || ng "leaderboard expected 200, got $(status_of "$R")"
grep -q '"top5"' <<<"$(body_of "$R")" && ok "leaderboard has top5 array" || ng "leaderboard missing top5"

R=$(fetch -H "origin: $ORIGIN" "$BASE/api/leaderboard/X")
[[ $(status_of "$R") == 404 ]] && ok "leaderboard 404 on invalid country" || ng "leaderboard should 404 on bad country (got $(status_of "$R"))"

# ---------- /api/comparison ----------
hdr "Comparison"
R=$(fetch -H "origin: $ORIGIN" "$BASE/api/comparison/BR")
[[ $(status_of "$R") == 200 ]] && ok "GET /api/comparison/BR → 200" || ng "comparison expected 200, got $(status_of "$R")"
grep -q '"country_top5"' <<<"$(body_of "$R")" && ok "comparison has country_top5" || ng "comparison missing country_top5"

# ---------- /api/elo (v2) ----------
hdr "Crowd ELO"
R=$(fetch -H "origin: $ORIGIN" "$BASE/api/elo?country=GLOBAL")
[[ $(status_of "$R") == 200 ]] && ok "GET /api/elo?country=GLOBAL → 200" || ng "elo GLOBAL expected 200, got $(status_of "$R")"
grep -qE '^\[' <<<"$(body_of "$R")" && ok "elo returns JSON array" || ng "elo response should be a JSON array"

R=$(fetch -H "origin: $ORIGIN" "$BASE/api/elo?country=US&party=R&limit=5")
[[ $(status_of "$R") == 200 ]] && ok "GET /api/elo?country=US&party=R&limit=5 → 200" || ng "elo US/R/5 expected 200, got $(status_of "$R")"

R=$(fetch -H "origin: $ORIGIN" "$BASE/api/elo?country=Brazil")
[[ $(status_of "$R") == 400 ]] && ok "GET /api/elo?country=Brazil → 400" || ng "elo bad country should 400 (got $(status_of "$R"))"

R=$(fetch -H "origin: $ORIGIN" "$BASE/api/elo?party=X")
[[ $(status_of "$R") == 400 ]] && ok "GET /api/elo?party=X → 400" || ng "elo bad party should 400 (got $(status_of "$R"))"

R=$(fetch -H "origin: $ORIGIN" "$BASE/api/elo?limit=99")
[[ $(status_of "$R") == 400 ]] && ok "GET /api/elo?limit=99 → 400" || ng "elo bad limit should 400 (got $(status_of "$R"))"

# ---------- /api/admin/* ----------
hdr "Admin"
R=$(fetch "$BASE/api/admin/overview")
ST=$(status_of "$R")
if [[ "$ST" == 401 || "$ST" == 503 ]]; then ok "admin without token → $ST (401 if configured / 503 if unset)"; else ng "admin without token should be 401 or 503 (got $ST)"; fi

if [[ -n "$ADMIN_TOKEN" ]]; then
  R=$(fetch -H "authorization: Bearer wrong-token" "$BASE/api/admin/overview")
  [[ $(status_of "$R") == 401 ]] && ok "admin wrong token → 401" || ng "admin wrong token should be 401 (got $(status_of "$R"))"
  R=$(fetch -H "authorization: Bearer $ADMIN_TOKEN" "$BASE/api/admin/overview")
  [[ $(status_of "$R") == 200 ]] && ok "admin correct token → 200" || ng "admin correct token should be 200 (got $(status_of "$R"))"
fi

# ---------- method / 404 ----------
hdr "Routing"
R=$(fetch -X GET "$BASE/api/vote")
[[ $(status_of "$R") == 405 ]] && ok "GET /api/vote → 405" || ng "GET /api/vote should 405"
R=$(fetch "$BASE/api/nonsense")
[[ $(status_of "$R") == 404 ]] && ok "GET /api/nonsense → 404" || ng "nonsense path should 404"

# ---------- summary ----------
hdr "Summary"
printf "  passed: %d\n  failed: %d\n" "$pass" "$fail"
if [[ $fail -gt 0 ]]; then
  echo "  failures:"
  for f in "${fail_list[@]}"; do echo "    - $f"; done
  exit 1
fi
echo "  all green ✓"
