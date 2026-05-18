#!/usr/bin/env bash
# Headless smoke test of the voting UI: skip behavior, back-from-additional-
# voting, and the Rank More / Keep Calibrating CTAs on the results screen.
#
# Boots a local static server + headless Chrome (with --remote-debugging-port)
# and drives the app via the DevTools Protocol. No persistent state; cleans up
# on exit. Requires: google-chrome on $PATH, node, `npm i ws` once below
# scripts/.
#
# Usage:  ./scripts/test_voting_ui.sh
# Exit code: 0 on all-pass, 1 on any failure, 2 on infra error.

set -e
cd "$(dirname "$0")/.."
REPO="$(pwd)"

# Ensure the ws node dep is available for the CDP driver. The 6KB module lives
# under scripts/node_modules/ws so this script is self-contained.
if [ ! -d "scripts/node_modules/ws" ]; then
  ( cd scripts && npm init -y > /dev/null 2>&1 || true; npm install --silent ws )
fi

# 1. Static server
python3 -m http.server 8765 --bind 127.0.0.1 > /tmp/voting-ui-server.log 2>&1 &
SERVER_PID=$!

# 2. Headless Chrome with CDP
PROFILE=$(mktemp -d)
google-chrome \
  --headless=new --no-sandbox --disable-gpu \
  --window-size=390,844 \
  --remote-debugging-port=9223 \
  --user-data-dir="$PROFILE" \
  about:blank > /tmp/voting-ui-chrome.log 2>&1 &
CHROME_PID=$!

cleanup() {
  kill $SERVER_PID 2>/dev/null || true
  kill $CHROME_PID 2>/dev/null || true
  rm -rf "$PROFILE"
}
trap cleanup EXIT

# Wait for CDP
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:9223/json/version" > /dev/null 2>&1; then break; fi
  sleep 0.5
done

# 3. Drive
node "$REPO/scripts/test_voting_ui.js" "http://127.0.0.1:8765/index.html"
