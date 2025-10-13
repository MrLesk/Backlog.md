#!/bin/bash
# Show Jira metadata for a Backlog task

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB_PATH="$PROJECT_ROOT/.backlog-jira/jira-sync.db"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <task-id>"
    echo "Example: $0 289"
    echo "         $0 task-289"
    exit 1
fi

TASK_ID="$1"
# Normalize task ID (add 'task-' prefix if not present)
if [[ ! "$TASK_ID" =~ ^task- ]]; then
    TASK_ID="task-$TASK_ID"
fi

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    echo "Have you run 'backlog-jira init'?"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Jira Metadata for $TASK_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if mapping exists
MAPPING=$(sqlite3 "$DB_PATH" "SELECT jira_key FROM mappings WHERE backlog_id = '$TASK_ID';" 2>/dev/null || echo "")

if [ -z "$MAPPING" ]; then
    echo "❌ No Jira mapping found for $TASK_ID"
    echo ""
    echo "To create a mapping, run:"
    echo "  bun run backlog-jira/src/cli.ts map interactive"
    exit 1
fi

echo ""
echo "🔗 Mapping Information"
echo "────────────────────────────────────────────────────────"
sqlite3 "$DB_PATH" "
SELECT 
  '  Backlog ID:    ' || backlog_id ||
  '\n  Jira Key:      ' || jira_key ||
  '\n  Mapped At:     ' || created_at ||
  '\n  Last Updated:  ' || updated_at
FROM mappings 
WHERE backlog_id = '$TASK_ID';
" | sed 's/\\n/\
/g'

echo ""
echo ""
echo "📊 Sync State"
echo "────────────────────────────────────────────────────────"
SYNC_STATE=$(sqlite3 "$DB_PATH" "SELECT last_sync_at, conflict_state FROM sync_state WHERE backlog_id = '$TASK_ID';" 2>/dev/null || echo "|")
LAST_SYNC=$(echo "$SYNC_STATE" | cut -d'|' -f1)
CONFLICT=$(echo "$SYNC_STATE" | cut -d'|' -f2)

if [ -n "$LAST_SYNC" ]; then
    echo "  Last Sync:     $LAST_SYNC"
else
    echo "  Last Sync:     Never"
fi

if [ -n "$CONFLICT" ]; then
    echo "  Conflict:      ⚠️  $CONFLICT"
else
    echo "  Conflict:      None"
fi

echo ""
echo ""
echo "🔍 Jira Snapshot (Current State)"
echo "────────────────────────────────────────────────────────"
JIRA_PAYLOAD=$(sqlite3 "$DB_PATH" "SELECT payload FROM snapshots WHERE backlog_id = '$TASK_ID' AND side = 'jira';" 2>/dev/null || echo "")

if [ -n "$JIRA_PAYLOAD" ]; then
    echo "$JIRA_PAYLOAD" | jq .
else
    echo "  No snapshot available"
fi

echo ""
echo "📝 Backlog Snapshot (Current State)"
echo "────────────────────────────────────────────────────────"
BACKLOG_PAYLOAD=$(sqlite3 "$DB_PATH" "SELECT payload FROM snapshots WHERE backlog_id = '$TASK_ID' AND side = 'backlog';" 2>/dev/null || echo "")

if [ -n "$BACKLOG_PAYLOAD" ]; then
    echo "$BACKLOG_PAYLOAD" | jq .
else
    echo "  No snapshot available"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
