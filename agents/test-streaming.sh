#!/bin/bash

echo "🧪 Testing streaming agents CLI..."

# Create test input
echo -e "hey. Are you guys there?\nexit" > /tmp/streaming_test_input.txt

echo "📝 Input: 'hey. Are you guys there?' + exit"
echo "🎯 Expected: Proper responses to the actual message, not the context"
echo ""

# Run the CLI with test input
timeout 30s bun run dev < /tmp/streaming_test_input.txt

# Clean up
rm -f /tmp/streaming_test_input.txt

echo ""
echo "✅ Streaming test completed!"