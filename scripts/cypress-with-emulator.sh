#!/bin/bash
#
# cypress-with-emulator.sh
#
# Runs Cypress component tests with the Firebase Firestore emulator.
# The emulator is started before tests and stopped after.
#
# Usage:
#   ./scripts/cypress-with-emulator.sh        # Run tests headlessly
#   ./scripts/cypress-with-emulator.sh open   # Open Cypress UI
#
# Prerequisites:
#   - Firebase CLI installed: npm install -g firebase-tools
#   - Java Runtime Environment (JRE) for the emulators

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
EMULATOR_PORT=8080
EMULATOR_UI_PORT=4000
EMULATOR_PID_FILE="$PROJECT_ROOT/.firebase-emulator.pid"

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

# Start the Firebase emulator
start_emulator() {
  log_info "Starting Firebase Firestore emulator..."
  
  # Check if port is already in use
  if is_port_in_use $EMULATOR_PORT; then
    log_warn "Port $EMULATOR_PORT is already in use. Assuming emulator is already running."
    return 0
  fi
  
  # Start emulator in background
  cd "$PROJECT_ROOT"
  firebase emulators:start --only firestore --project demo-bughouse &> /tmp/firebase-emulator.log &
  EMULATOR_PID=$!
  echo $EMULATOR_PID > "$EMULATOR_PID_FILE"
  
  log_info "Emulator starting with PID $EMULATOR_PID..."
  
  # Wait for emulator to be ready (max 30 seconds)
  local max_attempts=30
  local attempt=0
  
  while [ $attempt -lt $max_attempts ]; do
    if is_port_in_use $EMULATOR_PORT; then
      log_info "Firebase emulator is ready on port $EMULATOR_PORT"
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
  
  log_error "Emulator failed to start within 30 seconds"
  stop_emulator
  exit 1
}

# Stop the Firebase emulator
stop_emulator() {
  if [ -f "$EMULATOR_PID_FILE" ]; then
    local pid=$(cat "$EMULATOR_PID_FILE")
    if kill -0 $pid 2>/dev/null; then
      log_info "Stopping Firebase emulator (PID $pid)..."
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
}

# Cleanup on exit
cleanup() {
  local exit_code=$?
  log_info "Cleaning up..."
  stop_emulator
  exit $exit_code
}

# Main execution
main() {
  check_firebase_cli
  
  # Set up trap for cleanup
  trap cleanup EXIT INT TERM
  
  # Start emulator
  start_emulator
  
  # Determine Cypress command
  local cypress_cmd="run"
  if [ "$1" = "open" ]; then
    cypress_cmd="open"
  fi
  
  # Run Cypress
  log_info "Running Cypress component tests..."
  cd "$PROJECT_ROOT"
  npx cypress $cypress_cmd --component
}

main "$@"
