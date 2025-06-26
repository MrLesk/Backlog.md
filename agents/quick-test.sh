#!/bin/bash

echo "🧪 Testing agents CLI with fallback mode..."

# Create a test input file
echo -e "hello\nexit" > /tmp/test_input.txt

# Run the CLI with test input
echo "📝 Input: hello + exit"
timeout 15s bun run dev < /tmp/test_input.txt

# Clean up
rm -f /tmp/test_input.txt

echo ""
echo "✅ Test completed!"