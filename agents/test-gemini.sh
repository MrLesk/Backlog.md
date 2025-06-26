#!/bin/bash

echo "🧪 Testing Gemini CLI directly..."

# Test 1: Check if gemini command exists
if ! command -v gemini &> /dev/null; then
    echo "❌ 'gemini' command not found"
    exit 1
fi

# Test 2: Check version
echo "📋 Gemini version:"
gemini --version

# Test 3: Simple test message
echo ""
echo "💬 Testing simple message:"
echo "Hello, this is a test message" | gemini -p "Respond briefly to this greeting"

echo ""
echo "✅ Gemini CLI test completed"