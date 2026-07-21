#!/usr/bin/env bash
# Veto hook: scan written files for exposed secrets (no API key needed).
# Triggered by Claude Code PostToolUse after Write/Edit tool calls.
FILE="$1"
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0
PATTERNS='(api[_-]?key|secret[_-]?key|password|passwd|token|access[_-]?key|private[_-]?key)\s*[=:]\s*[A-Za-z0-9+/]{20,}'
if grep -qiE "$PATTERNS" "$FILE" 2>/dev/null; then
  echo "Veto: possible secret detected in $FILE — run veto_secrets_scan to confirm"
  exit 1
fi
exit 0
