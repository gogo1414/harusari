#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/home/sarah/.openclaw/workspace/harusari"
GH_REPO="gogo1414/harusari"
TITLE="[bot] Architecture guard report"

cd "$REPO_ROOT"
TMP_DIR="$(mktemp -d)"
OUT="$TMP_DIR/report.md"

check_count=0

append_section() {
  local name="$1"
  local cmd="$2"
  local key
  key=$(echo "$name" | tr ' /()' '____')
  local file="$TMP_DIR/${key}.txt"
  bash -lc "$cmd" > "$file" || true
  local n
  n=$(wc -l < "$file" | tr -d ' ')
  echo "### $name" >> "$OUT"
  echo "- findings: $n" >> "$OUT"
  echo '```' >> "$OUT"
  tail -n 80 "$file" >> "$OUT"
  echo '```' >> "$OUT"
  echo >> "$OUT"
  check_count=$((check_count + n))
}

{
  echo "## Architecture guard"
  echo
  echo "Generated at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo
} > "$OUT"

# Rule 1: UI(app/components) -> adapters 직접 의존 금지
append_section "UI imports adapters (forbidden)" \
  "rg -n \"from ['\\\"]@/lib/.*/adapters/\" app components"

# Rule 2: lib 계층이 app/components 역참조 금지
append_section "lib imports app/components (forbidden)" \
  "rg -n \"from ['\\\"]@/(app|components)/\" lib"

# Rule 3: app/components 내부에서 process.env 직접 사용 최소화(구성 누수)
append_section "UI direct process.env usage (review)" \
  "rg -n \"process\\.env\" app components"

# Rule 4: TODO/FIXME 누적 체크
append_section "TODO/FIXME debt" \
  "rg -n \"TODO|FIXME\" app components lib"

echo "Total findings: $check_count" >> "$OUT"

EXISTING=$(gh issue list --repo "$GH_REPO" --state open --search "$TITLE in:title" --json number --jq '.[0].number')
if [ -n "${EXISTING:-}" ] && [ "$EXISTING" != "null" ]; then
  gh issue comment "$EXISTING" --repo "$GH_REPO" --body-file "$OUT" >/dev/null
  echo "updated issue #$EXISTING"
else
  gh issue create --repo "$GH_REPO" --title "$TITLE" --body-file "$OUT" --label "bug" >/dev/null
  echo "created new issue"
fi

rm -rf "$TMP_DIR"
