#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RALPH_DIR="$ROOT_DIR/scripts/ralph"
SELECTED_TOOL="${RALPH_TOOL:-claude}"
TOOL_ARG_PROVIDED="false"
USE_DOCKER="false"
PASSTHROUGH_ARGS=()

show_help() {
  cat <<'EOF'
Usage: pnpm ralph [--tool claude|amp] [--docker] [--context N] [max_iterations]

AFK agent loop — implements GitHub issues autonomously.

Defaults:
  tool           claude
  max_iterations 100
  context        10   (last N commits passed as context)

Flags:
  --docker       Run inside Sand Castle container (requires Docker + ANTHROPIC_API_KEY)
  --context N    Number of recent commits to pass as context

Environment:
  RALPH_TOOL=claude|amp    Override default tool
  ANTHROPIC_API_KEY        Required for --docker mode
  GH_TOKEN / GITHUB_TOKEN  Required for gh CLI in --docker mode

Required before the first run:
  1. This repo must be a git repository with at least one commit
  2. gh CLI must be installed and authenticated (or GH_TOKEN set)
  3. The selected AI CLI (claude or amp) must be installed and authenticated
  4. Docker must be running (only for --docker mode)
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

PASSTHROUGH_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool)
      TOOL_ARG_PROVIDED="true"
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --tool. Use 'claude' or 'amp'."
        exit 1
      fi
      SELECTED_TOOL="$2"
      PASSTHROUGH_ARGS+=(--tool "$2")
      shift 2
      ;;
    --tool=*)
      TOOL_ARG_PROVIDED="true"
      SELECTED_TOOL="${1#*=}"
      PASSTHROUGH_ARGS+=("$1")
      shift
      ;;
    --docker)
      USE_DOCKER="true"
      PASSTHROUGH_ARGS+=(--docker)
      shift
      ;;
    --context)
      PASSTHROUGH_ARGS+=(--context "$2")
      shift 2
      ;;
    *)
      PASSTHROUGH_ARGS+=("$1")
      shift
      ;;
  esac
done

case "$SELECTED_TOOL" in
  claude|amp) ;;
  *)
    echo "Unsupported tool '$SELECTED_TOOL'. Use 'claude' or 'amp'."
    exit 1
    ;;
esac

# Validate deps
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install: brew install jq"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install: brew install gh"
  exit 1
fi

if [[ "$USE_DOCKER" == "true" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required for --docker mode."
    exit 1
  fi
else
  if ! command -v "$SELECTED_TOOL" >/dev/null 2>&1; then
    echo "The '$SELECTED_TOOL' CLI is required but not found on PATH."
    exit 1
  fi
fi

if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Ralph requires a git repository. Run 'git init' in $ROOT_DIR first."
  exit 1
fi

if ! git -C "$ROOT_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Ralph needs at least one git commit. Create an initial commit and try again."
  exit 1
fi

# Add default tool flag if not explicitly provided
if [[ "$TOOL_ARG_PROVIDED" == "false" ]]; then
  PASSTHROUGH_ARGS=(--tool "$SELECTED_TOOL" "${PASSTHROUGH_ARGS[@]+"${PASSTHROUGH_ARGS[@]}"}")
fi

exec "$RALPH_DIR/ralph.sh" "${PASSTHROUGH_ARGS[@]+"${PASSTHROUGH_ARGS[@]}"}"
