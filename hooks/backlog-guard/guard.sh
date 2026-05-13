#!/usr/bin/env bash
# PreToolUse hook — blocks Read/Edit/Write/Bash on files inside configured
# backlog directories and redirects the agent to the correct MCP tool or CLI
# command with a pre-filled call.
# Config: .backlog-guard YAML file at git root (auto-discovered). Falls back to
# detecting backlog/config.yml in the directory tree.
# Registered in ~/.claude/settings.json (user-global) or .claude/settings.local.json.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

input=$(cat)

export HOOK_TOOL HOOK_FP HOOK_CMD HOOK_INPUT
HOOK_TOOL=$(jq -r '.tool_name'                                    <<< "$input")
HOOK_FP=$(jq -r '.tool_input.file_path // .tool_input.path // ""' <<< "$input")
HOOK_CMD=$(jq -r '.tool_input.command // ""'                       <<< "$input")
HOOK_INPUT=$(jq -c '.tool_input'                                   <<< "$input")

python3 "$DIR/check.py"
