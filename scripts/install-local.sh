#!/usr/bin/env bash
#
# Recompile this fork and install the resulting standalone binary over the
# global `backlog` command in ~/.bun/bin, so the `backlog` on your PATH
# reflects your local changes.
#
# Usage (from anywhere; the script cd's to the repo root itself):
#   bash scripts/install-local.sh
#   # or via the package.json alias:
#   bun run install:local
#
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$repo_dir"

echo "==> Building (build:css + compile)…"
bun run build

# Locate the compiled binary. Bun appends .exe on Windows; plain name on POSIX.
if [ -f "dist/backlog.exe" ]; then
	src="dist/backlog.exe"
	dest="$HOME/.bun/bin/backlog.exe"
elif [ -f "dist/backlog" ]; then
	src="dist/backlog"
	dest="$HOME/.bun/bin/backlog"
else
	echo "error: no compiled binary found in dist/ — did 'bun run build' succeed?" >&2
	exit 1
fi

# Stop any running backlog process so the copy doesn't hit a Windows file
# lock (browser/watch/MCP all run as 'backlog'). Best-effort; ignored on
# POSIX or when nothing is running.
if command -v powershell >/dev/null 2>&1; then
	powershell -NoProfile -Command "Get-Process backlog -ErrorAction SilentlyContinue | Stop-Process -Force" >/dev/null 2>&1 || true
fi

mkdir -p "$(dirname "$dest")"
cp "$src" "$dest"

echo "==> Installed: $src -> $dest"
"$dest" --version >/dev/null 2>&1 && echo "==> backlog --version: $("$dest" --version)"
echo "==> Done. Restart any running 'backlog browser/watch' and start a fresh"
echo "    Claude Code session if you want the MCP server to pick up the new build."
