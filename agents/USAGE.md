# Agents CLI Usage Guide

## Quick Start

```bash
# Start multi-agent session (Claude + Gemini by default)
agents

# Include Codex
agents --agents claude,gemini,codex

# Single agent
agents --agents claude
```

## Conversation Examples

### Example 1: Default Session
```bash
$ agents
🚀 Starting multi-agent collaborative session...
📋 Agents: claude, gemini
🔄 Starting claude agent...
✅ claude agent ready
🔄 Starting gemini agent...
⚠️  gemini CLI not available, using fallback responses
✅ gemini agent ready (fallback mode)
✅ 2 agent(s) ready: claude, gemini

💡 Type your message and press Enter. All agents will respond.
💡 Type 'exit' to quit, 'clear' to clear conversation, or 'status' to see agent status.

You: How do I optimize React performance?

🤝 Agents are thinking...

🔵 CLAUDE:
[Real Claude response here if CLI available, or intelligent fallback]

🔴 GEMINI:
[Complementary response building on Claude's answer]

You: Can you show me code examples?

🤝 Agents are thinking...

🔵 CLAUDE:
[Code examples and detailed implementation]

🔴 GEMINI:
[Alternative approaches and additional insights]
```

### Example 2: Adding Codex
```bash
$ agents --agents claude,gemini,codex

You: I need to implement a REST API

🔵 CLAUDE:
I'll help you design a REST API. Here are the key considerations...

🔴 GEMINI:
Building on Claude's design, let me add some architectural perspectives...

🟡 CODEX:
From a technical implementation standpoint, here's specific code:

```javascript
const express = require('express');
const app = express();

app.get('/api/users', (req, res) => {
  // Implementation here
});
```
```

## Special Commands

- `exit` - End the session
- `clear` - Clear conversation history  
- `status` - Show which agents are active
- `help <topic>` - Get focused help on a specific topic

## Fallback Behavior

The CLI intelligently handles different scenarios:

### ✅ All CLIs Available
```bash
🔄 Starting claude agent...
✅ claude agent ready
🔄 Starting gemini agent...
✅ gemini agent ready
```

### ⚠️ Mixed Availability  
```bash
🔄 Starting claude agent...
✅ claude agent ready
🔄 Starting gemini agent...
⚠️  gemini CLI not available, using fallback responses
✅ gemini agent ready (fallback mode)
```

### 🔄 All Fallback Mode
```bash
🔄 Starting claude agent...
⚠️  claude CLI not available, using fallback responses
✅ claude agent ready (fallback mode)
🔄 Starting gemini agent...
⚠️  gemini CLI not available, using fallback responses
✅ gemini agent ready (fallback mode)
```

## Best Practices

1. **Start with defaults**: `agents` gives you Claude + Gemini
2. **Add Codex for coding**: Use `--agents claude,gemini,codex` for technical discussions
3. **Test individual agents**: Use `--agents claude` to isolate specific agent behavior
4. **Use clear commands**: Take advantage of `clear` to start fresh conversations
5. **Check status**: Use `status` to see which agents are real vs simulated

## Tips for Multi-Agent Collaboration

- **Ask follow-up questions**: Agents build on each other's responses
- **Reference previous answers**: "Can you expand on what Claude mentioned about..."
- **Compare approaches**: "What's the difference between Claude and Gemini's suggestions?"
- **Get code examples**: Mention "code" or "implementation" to trigger detailed technical responses
- **Use context**: The conversation history helps agents provide increasingly relevant responses