#!/usr/bin/env bash
# HeZi LibreAI deploy + smoke test.
# Run this once GHCR is public:
#   bash deploy-and-smoke.sh
#
# Steps:
#   0. Verify GHCR is anonymously pullable
#   1. Pull image + restart container on GCP
#   2. Wait for /health
#   3. Seed 10 invite codes
#   4. Smoke test: register without code (expect 400), with bad code (expect 400),
#      with good code (expect 200)
#   5. Verify NewAPI shadow user created + pluginAuths populated
#   6. Print pass/fail summary
#
# Exits non-zero on any failure so morning verification is binary.

set -u

SSH_HOST="gcp-cpa"
GCP_DIR="/opt/hezi-libreai"
SITE="https://hezi-next.flyli.cn"
GHCR_IMAGE="ghcr.io/flyli666/hezi-libreai:latest"
NEWAPI_BASE="https://newapi.flyli.cn"

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
note()  { printf "\033[36m[%s] %s\033[0m\n" "$(date +%H:%M:%S)" "$*"; }

PASS=0
FAIL=0
ok()   { green "  PASS  $*"; PASS=$((PASS+1)); }
nope() { red   "  FAIL  $*"; FAIL=$((FAIL+1)); }

# === 0. GHCR public check ===
note "0. Verifying GHCR is anonymously pullable"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://ghcr.io/v2/flyli666/hezi-libreai/manifests/latest")
if [ "$HTTP" = "401" ] || [ "$HTTP" = "403" ]; then
  red "GHCR still private (HTTP $HTTP). Flip visibility to Public:"
  red "  https://github.com/users/FlyLi666/packages/container/hezi-libreai/settings"
  exit 2
fi
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:flyli666/hezi-libreai:pull&service=ghcr.io" | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  red "GHCR anon-token endpoint returned no token. Package not public yet."
  exit 2
fi
M_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json" \
  "https://ghcr.io/v2/flyli666/hezi-libreai/manifests/latest")
if [ "$M_HTTP" != "200" ]; then
  red "GHCR manifest fetch with anon-issued token returned $M_HTTP. Not fully public."
  exit 2
fi
ok "GHCR public; manifest fetchable anonymously"

# === 1. Pull + restart on GCP ===
note "1. Pulling image + restarting container"
ssh "$SSH_HOST" "cd $GCP_DIR && docker compose pull librechat 2>&1 | tail -5" || { nope "docker compose pull failed"; exit 3; }
ssh "$SSH_HOST" "cd $GCP_DIR && docker compose up -d librechat" || { nope "docker compose up failed"; exit 3; }
ok "container restart issued"

# === 2. Wait for health ===
note "2. Waiting for $SITE/health (60s max)"
for i in $(seq 1 30); do
  H=$(curl -s -o /dev/null -w "%{http_code}" "$SITE/health" || echo "000")
  if [ "$H" = "200" ]; then
    ok "/health returned 200 after $((i*2))s"
    break
  fi
  sleep 2
done
if [ "$H" != "200" ]; then
  nope "/health never reached 200 (last=$H)"
  ssh "$SSH_HOST" "cd $GCP_DIR && docker compose logs --tail=40 librechat"
  exit 4
fi

# === 3. Seed invite codes ===
note "3. Seeding 10 invite codes"
SEED_OUT=$(ssh "$SSH_HOST" "cd $GCP_DIR && docker compose exec -T librechat npm run hezi-seed-invites -- --count=10 --note='smoke-test' 2>&1 | tail -25")
echo "$SEED_OUT"
# Extract codes (10-char base32)
CODES=$(echo "$SEED_OUT" | grep -oE '^\s+[A-Z2-9]{10}$' | tr -d ' ' | head -10)
N_CODES=$(echo "$CODES" | wc -l | tr -d ' ')
if [ "$N_CODES" -lt 10 ]; then
  nope "expected 10 seed codes, got $N_CODES"
  exit 5
fi
ok "seeded $N_CODES codes"

CODE_GOOD=$(echo "$CODES" | head -1)
CODE_USED_LATER=$(echo "$CODES" | sed -n '2p')

# === 4. Registration tests ===
note "4. Testing /api/auth/register"
TS=$(date +%s)

# 4a: missing inviteCode → expect 400 INVITE_CODE_REQUIRED
R=$(curl -s -w "\nHTTP_%{http_code}" -X POST "$SITE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"smoke a\",\"username\":\"smoke_a_$TS\",\"email\":\"smoke_a_$TS@flyli.cn\",\"password\":\"SmokeTest123!\",\"confirm_password\":\"SmokeTest123!\"}")
echo "$R" | tail -3
if echo "$R" | grep -q "INVITE_CODE_REQUIRED"; then ok "missing code rejected"; else nope "missing code not rejected as expected"; fi

# 4b: bad code → expect 400 INVITE_CODE_INVALID
R=$(curl -s -w "\nHTTP_%{http_code}" -X POST "$SITE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"smoke b\",\"username\":\"smoke_b_$TS\",\"email\":\"smoke_b_$TS@flyli.cn\",\"password\":\"SmokeTest123!\",\"confirm_password\":\"SmokeTest123!\",\"inviteCode\":\"NOSUCHCODE\"}")
echo "$R" | tail -3
if echo "$R" | grep -q "INVITE_CODE_INVALID"; then ok "bad code rejected"; else nope "bad code not rejected as expected"; fi

# 4c: good code → expect 200
EMAIL_OK="smoke_$TS@flyli.cn"
R=$(curl -s -w "\nHTTP_%{http_code}" -X POST "$SITE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"smoke ok\",\"username\":\"smoke_ok_$TS\",\"email\":\"$EMAIL_OK\",\"password\":\"SmokeTest123!\",\"confirm_password\":\"SmokeTest123!\",\"inviteCode\":\"$CODE_GOOD\"}")
echo "$R" | tail -3
HTTP_OK=$(echo "$R" | grep -oE 'HTTP_[0-9]+$' | tr -d 'HTTP_')
if [ "$HTTP_OK" = "200" ]; then ok "good code registration returned 200"; else nope "good code registration returned $HTTP_OK"; fi

# === 5. Verify NewAPI shadow + pluginAuths ===
sleep 2
note "5. Verifying NewAPI shadow account"
# Find newapiUserId via mongosh
USER_ID=$(ssh "$SSH_HOST" "cd $GCP_DIR && docker compose exec -T mongodb mongosh LibreAI --quiet --eval \"
  const u = db.users.findOne({email: '$EMAIL_OK'});
  print(u ? u._id.toString() : 'NOT_FOUND');
\"" 2>&1 | tr -d '\r')
echo "  LibreChat _id: $USER_ID"
if [ "$USER_ID" = "NOT_FOUND" ] || [ -z "$USER_ID" ]; then
  nope "user $EMAIL_OK not found in MongoDB"
else
  ok "user inserted in MongoDB"
fi

PA_COUNT=$(ssh "$SSH_HOST" "cd $GCP_DIR && docker compose exec -T mongodb mongosh LibreAI --quiet --eval \"
  print(db.pluginauths.countDocuments({userId: '$USER_ID', pluginKey: 'newapi-shadow'}));
\"" 2>&1 | tr -d '\r')
echo "  pluginauths rows: $PA_COUNT"
if [ "$PA_COUNT" -ge 3 ]; then ok "pluginAuths populated ($PA_COUNT rows)"; else nope "pluginAuths missing (expected ≥3, got $PA_COUNT)"; fi

# Check shadow username via NewAPI admin
SHADOW_USERNAME="hezi_${USER_ID: -12}"
note "  Looking up NewAPI user: $SHADOW_USERNAME"
source /Users/lishupeng/.config/hezi/tokens.env
NEWAPI_R=$(curl -s -H "Authorization: $NEWAPI_ADMIN_TOKEN" -H "New-Api-User: $NEWAPI_ADMIN_USER_ID" \
  "$NEWAPI_BASE/api/user/?p=0&page_size=100" | jq -r ".data.items[] | select(.username==\"$SHADOW_USERNAME\") | .id")
if [ -n "$NEWAPI_R" ]; then ok "NewAPI shadow user exists (id=$NEWAPI_R)"; else nope "NewAPI shadow user $SHADOW_USERNAME not found"; fi

# === Summary ===
echo
if [ $FAIL -eq 0 ]; then
  green "=========================================="
  green "  ALL CHECKS PASSED ($PASS/$PASS)"
  green "=========================================="
  exit 0
else
  red   "=========================================="
  red   "  $FAIL FAILURES, $PASS passes"
  red   "=========================================="
  exit 1
fi
