#!/bin/bash
# Ralph Wiggum — AFK Agent Loop
# Pulls open GitHub issues, implements each one, closes when done.
#
# Usage: ./ralph.sh [--tool claude|amp] [--docker] [--context N] [max_iterations]

set -e

TOOL="claude"
MAX_ITERATIONS=100
USE_DOCKER=false
CONTEXT_COMMITS=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)       TOOL="$2";            shift 2 ;;
    --tool=*)     TOOL="${1#*=}";       shift   ;;
    --docker)     USE_DOCKER=true;      shift   ;;
    --context)    CONTEXT_COMMITS="$2"; shift 2 ;;
    *)            [[ "$1" =~ ^[0-9]+$ ]] && MAX_ITERATIONS="$1"; shift ;;
  esac
done

if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Sand Castle: Docker mode ──────────────────────────────────────────────────
# Builds the Sand Castle image, mounts the working directory inside the
# container, and runs ralph there. Commits appear on the host via the volume.
# After the run, new commits are extracted as patches for review if desired.
if [[ "$USE_DOCKER" == "true" ]]; then
  IMAGE="ralph-sandcastle"
  echo "Building Sand Castle container..."
  docker build -t "$IMAGE" "$SCRIPT_DIR"

  BEFORE_HEAD=$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo "")

  echo "Starting Sand Castle run (tool=$TOOL, max=$MAX_ITERATIONS)..."
  docker run --rm \
    -v "$ROOT_DIR:/workspace" \
    -w /workspace \
    -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    -e GH_TOKEN="${GH_TOKEN:-}" \
    -e GITHUB_TOKEN="${GITHUB_TOKEN:-}" \
    "$IMAGE" \
    -c "scripts/ralph/ralph.sh --tool $TOOL $MAX_ITERATIONS"

  # Extract commits made inside the container as patches for optional review
  AFTER_HEAD=$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo "")
  if [[ -n "$BEFORE_HEAD" && "$BEFORE_HEAD" != "$AFTER_HEAD" ]]; then
    PATCH_DIR="$SCRIPT_DIR/patches/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$PATCH_DIR"
    git -C "$ROOT_DIR" format-patch "$BEFORE_HEAD".."$AFTER_HEAD" -o "$PATCH_DIR"
    echo ""
    echo "Patches saved to: $PATCH_DIR"
    echo "Apply with: git am $PATCH_DIR/*.patch"
  fi

  exit $?
fi

# ── Local mode ────────────────────────────────────────────────────────────────
echo "Starting Ralph — tool=$TOOL  max=$MAX_ITERATIONS  context=last $CONTEXT_COMMITS commits"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "================================================================"
  echo "  Ralph Iteration $i / $MAX_ITERATIONS  ($TOOL)"
  echo "================================================================"

  # Fetch open issues
  OPEN_ISSUES=$(gh issue list \
    --state open \
    --json number,title,body,labels \
    --limit 50 2>/dev/null || echo "[]")
  ISSUE_COUNT=$(echo "$OPEN_ISSUES" | jq 'length')

  if [[ "$ISSUE_COUNT" -eq 0 ]]; then
    echo "No open issues. Ralph is done!"
    exit 0
  fi

  echo "Open issues: $ISSUE_COUNT"

  # Recent commits for codebase context
  RECENT_COMMITS=$(git -C "$ROOT_DIR" log --oneline -"$CONTEXT_COMMITS" 2>/dev/null \
    || echo "(no commits yet)")

  # Build context block appended to agent prompt
  CONTEXT_BLOCK=$(cat <<CONTEXT

---
## Current Open GitHub Issues

$(echo "$OPEN_ISSUES" | jq -r '.[] | "### Issue #\(.number): \(.title)\n\(.body // "(no description)")\n"')

## Recent Commits (last $CONTEXT_COMMITS)

$RECENT_COMMITS
CONTEXT
)

  # Run agent
  if [[ "$TOOL" == "claude" ]]; then
    PROMPT="$(cat "$SCRIPT_DIR/CLAUDE.md")$CONTEXT_BLOCK"
    OUTPUT=$(printf '%s' "$PROMPT" \
      | claude --dangerously-skip-permissions --print 2>&1 | tee /dev/stderr) || true
  else
    PROMPT="$(cat "$SCRIPT_DIR/prompt.md")$CONTEXT_BLOCK"
    OUTPUT=$(printf '%s' "$PROMPT" \
      | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  fi

  # Completion check
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph completed all issues at iteration $i / $MAX_ITERATIONS."
    exit 0
  fi

  echo "Iteration $i done. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without finishing."
exit 1
