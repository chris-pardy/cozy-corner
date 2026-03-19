#!/usr/bin/env bash
#
# Reset the local PDS and seed it with two test accounts.
# Usage: ./pds/seed.sh
#
# This tears down the PDS container, destroys the data volume,
# brings it back up, and creates the test accounts.
#
# Accounts created:
#   cozy-demo.test   / demo-password-123
#   cozy-friend.test / friend-password-123

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PDS_URL="${PDS_URL:-http://localhost:2583}"
ADMIN_PASSWORD="985907cd1f1f0ab188539617132cd7c2"

auth_header="Authorization: Basic $(printf 'admin:%s' "$ADMIN_PASSWORD" | base64)"

# --- Reset ---
echo "Tearing down PDS..."
docker compose -f "$SCRIPT_DIR/docker-compose.yaml" down -v
echo "Starting PDS..."
docker compose -f "$SCRIPT_DIR/docker-compose.yaml" up -d

# --- Wait for PDS ---
echo "Waiting for PDS at $PDS_URL..."
for i in $(seq 1 30); do
  if curl -sf "$PDS_URL/xrpc/_health" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "PDS not reachable after 30s, aborting."
    exit 1
  fi
  sleep 1
done
echo "PDS is up."

# --- Create accounts ---
create_account() {
  local handle="$1"
  local password="$2"
  local email="$3"

  local invite
  invite=$(curl -sf -X POST "$PDS_URL/xrpc/com.atproto.server.createInviteCode" \
    -H 'Content-Type: application/json' \
    -H "$auth_header" \
    -d '{"useCount":1}')
  local code
  code=$(echo "$invite" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)

  local result
  result=$(curl -sf -X POST "$PDS_URL/xrpc/com.atproto.server.createAccount" \
    -H 'Content-Type: application/json' \
    -d "{\"handle\":\"$handle\",\"email\":\"$email\",\"password\":\"$password\",\"inviteCode\":\"$code\"}")
  local did
  did=$(echo "$result" | grep -o '"did":"[^"]*"' | head -1 | cut -d'"' -f4)

  echo "  $handle -> $did"
}

echo "Creating accounts..."
create_account "cozy-demo.test"   "demo-password-123"   "demo@test.com"
create_account "cozy-friend.test" "friend-password-123" "friend@test.com"
echo "Done."
