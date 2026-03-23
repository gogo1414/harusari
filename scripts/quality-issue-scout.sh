#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/home/sarah/.openclaw/workspace/harusari"
GH_REPO="gogo1414/harusari"
TITLE="[bot] Quality check report"

cd "$REPO_ROOT"

TS="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
TMP_DIR="$(mktemp -d)"
LINT_LOG="$TMP_DIR/lint.log"
TEST_LOG="$TMP_DIR/test.log"

LINT_STATUS=0
TEST_STATUS=0

npm run -s lint >"$LINT_LOG" 2>&1 || LINT_STATUS=$?
npm test -- --runInBand >"$TEST_LOG" 2>&1 || TEST_STATUS=$?

LINT_WARNINGS=$(grep -E "warning" "$LINT_LOG" | wc -l | tr -d ' ')
LINT_ERRORS=$(grep -E "error" "$LINT_LOG" | wc -l | tr -d ' ')

if [ "$TEST_STATUS" -eq 0 ]; then
  TEST_SUMMARY="PASS"
else
  TEST_SUMMARY="FAIL"
fi

BODY_FILE="$TMP_DIR/body.md"
{
  echo "## Quality check @ $TS"
  echo
  echo "- lint exit: $LINT_STATUS"
  echo "- lint warnings(lines): $LINT_WARNINGS"
  echo "- lint errors(lines): $LINT_ERRORS"
  echo "- test status: $TEST_SUMMARY"
  echo
  echo "### Lint (tail)"
  echo '```'
  tail -n 60 "$LINT_LOG"
  echo '```'
  echo
  echo "### Test (tail)"
  echo '```'
  tail -n 60 "$TEST_LOG"
  echo '```'
} > "$BODY_FILE"

EXISTING=$(gh issue list --repo "$GH_REPO" --state open --search "$TITLE in:title" --json number --jq '.[0].number')

if [ -n "${EXISTING:-}" ] && [ "$EXISTING" != "null" ]; then
  gh issue comment "$EXISTING" --repo "$GH_REPO" --body-file "$BODY_FILE"
  echo "updated issue #$EXISTING"
else
  gh issue create --repo "$GH_REPO" --title "$TITLE" --body-file "$BODY_FILE" --label "bug" >/dev/null
  echo "created new issue"
fi

rm -rf "$TMP_DIR"
