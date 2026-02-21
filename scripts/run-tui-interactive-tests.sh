#!/usr/bin/env bash
set -euo pipefail

if ! command -v expect >/dev/null 2>&1; then
	echo "Skipping interactive TUI tests: expect is not installed."
	exit 0
fi

echo "Running interactive TUI editor handoff tests with expect..."
RUN_INTERACTIVE_TUI_TESTS=1 bun test src/test/tui-interactive-editor-handoff.test.ts --timeout=30000
