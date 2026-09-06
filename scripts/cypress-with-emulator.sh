#!/bin/bash
# Run Cypress against an owned Firebase demo stack; never reuse or stop other servers.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
TEST_TYPE=component
CYPRESS_COMMAND=run
if [ "${1:-}" = e2e ]; then TEST_TYPE=e2e; shift; fi
if [ "${1:-}" = open ]; then CYPRESS_COMMAND=open; shift; fi
command -v firebase >/dev/null || { echo 'Firebase CLI is required on PATH.' >&2; exit 1; }

for port in 9099 8080 4000 4400 4500 9150; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is occupied. Stop that service or run the tests in an isolated environment." >&2
    exit 1
  fi
done
if [ "$TEST_TYPE" = e2e ] && lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo 'Port 3000 is occupied. Stop that server before running E2E tests.' >&2
  exit 1
fi

RUN_LOGS=$(mktemp -d "${TMPDIR:-/tmp}/relay-cypress.XXXXXX")
EMULATOR_PID=''
NEXTJS_PID=''
cleanup() {
  status=$?
  trap - EXIT INT TERM
  if [ -n "$NEXTJS_PID" ]; then kill "$NEXTJS_PID" 2>/dev/null || true; wait "$NEXTJS_PID" 2>/dev/null || true; fi
  if [ -n "$EMULATOR_PID" ]; then kill "$EMULATOR_PID" 2>/dev/null || true; wait "$EMULATOR_PID" 2>/dev/null || true; fi
  echo "Test service logs: $RUN_LOGS"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

wait_for_http() {
  local url=$1 pid=$2 log=$3
  for ((attempt=0; attempt<90; attempt++)); do
    if curl --max-time 2 -fsS "$url" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$pid" 2>/dev/null; then cat "$log"; return 1; fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  tail -60 "$log"
  return 1
}

# Explicit demo settings take precedence over developer .env.local values.
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export NEXT_PUBLIC_FIREBASE_API_KEY=fake-api-key-for-testing
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-bughouse.firebaseapp.com
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-bughouse
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-bughouse.appspot.com
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
export NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
export NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=''
export NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=''
export NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-bughouse
export FIREBASE_PRIVATE_KEY=''
export FIREBASE_CLIENT_EMAIL=''

firebase emulators:start --only auth,firestore --project demo-bughouse >"$RUN_LOGS/firebase.log" 2>&1 &
EMULATOR_PID=$!
wait_for_http http://127.0.0.1:9099/emulator/v1/projects/demo-bughouse/config "$EMULATOR_PID" "$RUN_LOGS/firebase.log"
wait_for_http http://127.0.0.1:8080/ "$EMULATOR_PID" "$RUN_LOGS/firebase.log"

if [ "$TEST_TYPE" = e2e ]; then
  export CHESSCOM_REQUEST_LOG="$RUN_LOGS/chesscom-requests.jsonl"
  touch "$CHESSCOM_REQUEST_LOG"
  NODE_OPTIONS="${NODE_OPTIONS:-} --import=$PROJECT_ROOT/tests/support/chesscom-fixtures.mjs" node node_modules/next/dist/bin/next dev >"$RUN_LOGS/next.log" 2>&1 &
  NEXTJS_PID=$!
  wait_for_http http://localhost:3000/ "$NEXTJS_PID" "$RUN_LOGS/next.log"
fi
npx cypress "$CYPRESS_COMMAND" "--$TEST_TYPE" "$@"
