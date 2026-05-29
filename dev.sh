#!/usr/bin/env bash
# dev.sh — start (or restart) the Ad Studio dev environment
#
# Usage:
#   ./dev.sh            # start both server and client
#   ./dev.sh --restart  # kill any running instances, then start fresh

set -euo pipefail

# Ensure Homebrew and common Node version manager paths are on PATH
# (shells launched outside a login session often lack these)
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ENV="$ROOT_DIR/packages/server/.env"
SERVER_PORT=3001
CLIENT_PORT=5173

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[ad-studio]${RESET} $*"; }
success() { echo -e "${GREEN}[ad-studio]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[ad-studio]${RESET} $*"; }
fatal()   { echo -e "${RED}[ad-studio] ERROR:${RESET} $*" >&2; exit 1; }

# ── Restart: kill processes on both ports ─────────────────────────────────────
if [[ "${1:-}" == "--restart" ]]; then
  info "Stopping existing processes on ports $SERVER_PORT and $CLIENT_PORT…"
  for port in $SERVER_PORT $CLIENT_PORT; do
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
      info "  Killed process(es) on port $port"
    fi
  done
  sleep 1
fi

# ── Node version check ────────────────────────────────────────────────────────
node_major=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null || echo "0")
if (( node_major < 20 )); then
  fatal "Node.js 20+ required (found v$(node --version 2>/dev/null || echo '?'))"
fi

# ── Env file ──────────────────────────────────────────────────────────────────
if [[ ! -f "$SERVER_ENV" ]]; then
  if [[ -f "$ROOT_DIR/.env.example" ]]; then
    cp "$ROOT_DIR/.env.example" "$SERVER_ENV"
    success "Created packages/server/.env from .env.example"
  else
    fatal ".env.example not found — cannot create packages/server/.env"
  fi
else
  info "Using existing packages/server/.env"
fi

# ── Install dependencies ──────────────────────────────────────────────────────
# Always run from root — npm workspaces installs everything (root + packages)
# in one pass and is idempotent when node_modules is already up to date.
info "Checking dependencies…"
npm install --prefix "$ROOT_DIR" --silent
success "Dependencies ready"

# ── Chromium check (Puppeteer) ────────────────────────────────────────────────
if ! command -v google-chrome &>/dev/null && \
   ! command -v chromium &>/dev/null && \
   ! command -v chromium-browser &>/dev/null && \
   [[ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]]; then
  warn "Chromium not found in PATH — URL crawling will fall back to Puppeteer's bundled browser."
  warn "If crawl jobs hang, install it: brew install --cask chromium"
fi

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Ad Studio — starting dev environment${RESET}"
echo -e "  ${CYAN}Client${RESET}  →  http://localhost:${CLIENT_PORT}"
echo -e "  ${YELLOW}Server${RESET}  →  http://localhost:${SERVER_PORT}"
echo -e "  ${YELLOW}Health${RESET}  →  http://localhost:${SERVER_PORT}/api/health"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop both processes."
echo ""

cd "$ROOT_DIR"
exec npm run dev
