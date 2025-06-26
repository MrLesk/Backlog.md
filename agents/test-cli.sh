#!/bin/bash

echo "Testing agents CLI..."

# Test 1: Check if agents CLI is built
if [ ! -f "dist/cli.js" ]; then
    echo "❌ CLI not built. Running build..."
    bun run build
fi

# Test 2: Test help command
echo "🔍 Testing help command..."
echo "Hello world" | timeout 10s bun run dist/cli.js help "testing" --agents claude 2>&1 | head -20

echo ""
echo "🔍 Testing demo mode..."
echo -e "hello\nexit" | timeout 10s bun run demo 2>&1 | head -20

echo ""
echo "✅ Test completed. If you see timeouts, the real CLI agents may not be properly configured."
echo "💡 Try 'bun run demo' for a working simulation first."