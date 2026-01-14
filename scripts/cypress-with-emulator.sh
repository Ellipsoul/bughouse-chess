#!/bin/bash
#
# cypress-with-emulator.sh
#
# Runs Cypress component or E2E tests with Firebase Auth and Firestore emulators.
# For E2E tests, also starts and manages the Next.js dev server.
#
# Usage:
#   ./scripts/cypress-with-emulator.sh              # Run component tests headlessly
#   ./scripts/cypress-with-emulator.sh open         # Open component tests in Cypress UI
#   ./scripts/cypress-with-emulator.sh e2e          # Run E2E tests headlessly
#   ./scripts/cypress-with-emulator.sh e2e open     # Open E2E tests in Cypress UI
#
# Prerequisites:
#   - Firebase CLI installed: npm install -g firebase-tools
#   - Java Runtime Environment (JRE) for the emulators

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
AUTH_EMULATOR_PORT=9099
FIRESTORE_EMULATOR_PORT=8080
EMULATOR_UI_PORT=4000
NEXTJS_PORT=3000
EMULATOR_PID_FILE="$PROJECT_ROOT/.firebase-emulator.pid"
NEXTJS_PID_FILE="$PROJECT_ROOT/.nextjs-server.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Firebase CLI is installed
check_firebase_cli() {
  if ! command -v firebase &> /dev/null; then
    log_error "Firebase CLI is not installed."
    log_info "Install it with: npm install -g firebase-tools"
    exit 1
  fi
}

# Check if emulator port is already in use
is_port_in_use() {
  lsof -i ":$1" &> /dev/null
}

# Start the Firebase emulators
start_emulator() {
  log_info "Starting Firebase Auth and Firestore emulators..."

  # Check if either port is already in use
  local auth_in_use=false
  local firestore_in_use=false

  if is_port_in_use $AUTH_EMULATOR_PORT; then
    auth_in_use=true
  fi

  if is_port_in_use $FIRESTORE_EMULATOR_PORT; then
    firestore_in_use=true
  fi

  if [ "$auth_in_use" = true ] && [ "$firestore_in_use" = true ]; then
    log_warn "Ports $AUTH_EMULATOR_PORT and $FIRESTORE_EMULATOR_PORT are already in use. Assuming emulators are already running."
    return 0
  fi

  if [ "$auth_in_use" = true ] || [ "$firestore_in_use" = true ]; then
    log_warn "Some emulator ports are in use but not all. Stopping existing emulators..."
    stop_emulator
  fi

  # Start emulators in background
  cd "$PROJECT_ROOT"
  firebase emulators:start --only auth,firestore --project demo-bughouse &> /tmp/firebase-emulator.log &
  EMULATOR_PID=$!
  echo $EMULATOR_PID > "$EMULATOR_PID_FILE"

  log_info "Emulators starting with PID $EMULATOR_PID..."

  # Wait for both emulators to be ready (max 45 seconds)
  local max_attempts=45
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    local auth_ready=false
    local firestore_ready=false

    if is_port_in_use $AUTH_EMULATOR_PORT; then
      auth_ready=true
    fi

    if is_port_in_use $FIRESTORE_EMULATOR_PORT; then
      firestore_ready=true
    fi

    if [ "$auth_ready" = true ] && [ "$firestore_ready" = true ]; then
      log_info "Firebase Auth emulator is ready on port $AUTH_EMULATOR_PORT"
      log_info "Firebase Firestore emulator is ready on port $FIRESTORE_EMULATOR_PORT"
      log_info "Emulator UI available at http://127.0.0.1:$EMULATOR_UI_PORT"
      return 0
    fi

    # Check if process is still running
    if ! kill -0 $EMULATOR_PID 2>/dev/null; then
      log_error "Emulator process died unexpectedly. Check /tmp/firebase-emulator.log for details."
      cat /tmp/firebase-emulator.log
      exit 1
    fi

    sleep 1
    ((attempt++))
  done

  log_error "Emulators failed to start within 45 seconds"
  stop_emulator
  exit 1
}

# Stop the Firebase emulators
stop_emulator() {
  if [ -f "$EMULATOR_PID_FILE" ]; then
    local pid=$(cat "$EMULATOR_PID_FILE")
    if kill -0 $pid 2>/dev/null; then
      log_info "Stopping Firebase emulators (PID $pid)..."
      kill $pid 2>/dev/null || true
      # Give it a moment to stop gracefully
      sleep 2
      # Force kill if still running
      if kill -0 $pid 2>/dev/null; then
        kill -9 $pid 2>/dev/null || true
      fi
    fi
    rm -f "$EMULATOR_PID_FILE"
  fi

  # Also kill any orphaned emulator processes
  pkill -f "firebase.*emulators" 2>/dev/null || true
}

# Start the Next.js dev server
start_nextjs() {
  log_info "Starting Next.js dev server..."

  # Check if port is already in use
  if is_port_in_use $NEXTJS_PORT; then
    log_warn "Port $NEXTJS_PORT is already in use. Assuming Next.js server is already running."
    return 0
  fi

  # Start Next.js dev server in background
  cd "$PROJECT_ROOT"
  npm run dev &> /tmp/nextjs-server.log &
  NEXTJS_PID=$!
  echo $NEXTJS_PID > "$NEXTJS_PID_FILE"

  log_info "Next.js server starting with PID $NEXTJS_PID..."

  # Wait for Next.js to be ready (max 60 seconds)
  local max_attempts=60
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    # Check if the server responds to HTTP requests
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$NEXTJS_PORT" 2>/dev/null | grep -q "200\|304"; then
      log_info "Next.js server is ready on port $NEXTJS_PORT"
      return 0
    fi

    # Also check if port is in use (server is starting)
    if is_port_in_use $NEXTJS_PORT; then
      # Port is in use, but server might not be fully ready yet
      # Try a simple request
      if curl -s "http://localhost:$NEXTJS_PORT" &>/dev/null; then
        log_info "Next.js server is ready on port $NEXTJS_PORT"
        return 0
      fi
    fi

    # Check if process is still running
    if ! kill -0 $NEXTJS_PID 2>/dev/null; then
      log_error "Next.js server process died unexpectedly. Check /tmp/nextjs-server.log for details."
      tail -50 /tmp/nextjs-server.log
      exit 1
    fi

    sleep 1
    ((attempt++))
  done

  log_error "Next.js server failed to start within 60 seconds"
  stop_nextjs
  exit 1
}

# Stop the Next.js dev server
stop_nextjs() {
  if [ -f "$NEXTJS_PID_FILE" ]; then
    local pid=$(cat "$NEXTJS_PID_FILE")
    if kill -0 $pid 2>/dev/null; then
      log_info "Stopping Next.js server (PID $pid)..."
      kill $pid 2>/dev/null || true
      # Give it a moment to stop gracefully
      sleep 1
      # Force kill if still running
      if kill -0 $pid 2>/dev/null; then
        kill -9 $pid 2>/dev/null || true
      fi
    fi
    rm -f "$NEXTJS_PID_FILE"
  fi

  # Also kill any orphaned Next.js processes on our port
  # Be careful to only kill the dev server, not other Next.js processes
  local next_pid=$(lsof -ti :$NEXTJS_PORT 2>/dev/null)
  if [ -n "$next_pid" ]; then
    log_info "Killing process on port $NEXTJS_PORT (PID $next_pid)..."
    kill $next_pid 2>/dev/null || true
  fi
}

# Cleanup on exit
cleanup() {
  local exit_code=$?
  log_info "Cleaning up..."
  stop_nextjs
  stop_emulator
  exit $exit_code
}

# Main execution
main() {
  check_firebase_cli

  # Set up trap for cleanup
  trap cleanup EXIT INT TERM

  # Determine test type (component or e2e)
  local test_type="component"
  local cypress_cmd="run"
  local extra_args=""

  if [ "$1" = "e2e" ]; then
    test_type="e2e"
    shift
  fi

  if [ "$1" = "open" ]; then
    cypress_cmd="open"
    shift
  fi

  # Collect any remaining arguments to pass to Cypress
  extra_args="$@"

  # Start emulators
  start_emulator

  # For E2E tests, also start Next.js server
  if [ "$test_type" = "e2e" ]; then
    start_nextjs
  fi

  # Run Cypress based on test type
  cd "$PROJECT_ROOT"

  if [ "$test_type" = "e2e" ]; then
    log_info "Running Cypress E2E tests..."
    npx cypress $cypress_cmd --e2e $extra_args
  else
    log_info "Running Cypress component tests..."
    npx cypress $cypress_cmd --component $extra_args
  fi
}

main "$@"
