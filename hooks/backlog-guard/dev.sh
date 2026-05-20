#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DIR/../.." && pwd)"

case "${1:-all}" in
  test)
    echo ":: Running tests..."
    bun test "$DIR/guard-core.test.ts"
    ;;
  build)
    echo ":: Building JS bundles..."
    bun build "$DIR/opencode-plugin.ts" --outfile "$DIR/opencode-plugin.js" --target=node --format=esm
    bun build "$DIR/claude-hook.ts" --outfile "$DIR/claude-hook.js" --target=node --format=esm --external=yaml --external=shell-quote
    echo ":: Copy to npm package..."
    cp "$DIR/opencode-plugin.js" "$REPO/packages/backlog-guard/opencode-plugin.js"
    echo ":: Done. $(wc -c < "$DIR/opencode-plugin.js")B opencode-plugin.js, $(wc -c < "$DIR/claude-hook.js")B claude-hook.js"
    ;;
  check)
    echo ":: Biome check..."
    cd "$REPO" && bun run check .
    echo ":: TypeScript check..."
    bunx tsc --noEmit --pretty 2>&1 | tail -5 || true
    ;;
  all)
    "$0" check
    "$0" test
    "$0" build
    echo ":: All checks passed."
    ;;
  *)
    echo "Usage: $0 {test|build|check|all}"
    exit 1
    ;;
esac
