#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="${REPO_PATH:-/workspace}"
PORT="${PORT:-8765}"
TRANSPORT="${TRANSPORT:-streamableHttp}"

if [ ! -d "$REPO_PATH/.git" ] && [ ! -d "$REPO_PATH/backlog" ]; then
	echo "Warning: $REPO_PATH doesn't look like a git repo or an initialized Backlog.md project (no .git or backlog/ found)." >&2
fi

# Backlog.md commits task changes via the real git binary; give it an identity
# if the mounted repo doesn't already have one configured.
if [ -z "$(git -C "$REPO_PATH" config user.email 2>/dev/null || true)" ]; then
	git config --global user.email "${GIT_AUTHOR_EMAIL:-backlog-mcp@localhost}"
	git config --global user.name "${GIT_AUTHOR_NAME:-Backlog MCP}"
fi
git config --global --add safe.directory "$REPO_PATH"

MCP_CMD="bun /app/src/cli.ts mcp start --cwd $REPO_PATH"

case "$TRANSPORT" in
sse)
	exec bunx -y supergateway --stdio "$MCP_CMD" --port "$PORT" --ssePath /sse --messagePath /message
	;;
streamableHttp)
	exec bunx -y supergateway --stdio "$MCP_CMD" --outputTransport streamableHttp --port "$PORT"
	;;
*)
	echo "Unknown TRANSPORT '$TRANSPORT' (expected 'sse' or 'streamableHttp')" >&2
	exit 1
	;;
esac
