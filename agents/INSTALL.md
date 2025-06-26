# Agents CLI Installation & Usage

## Installation

1. **Build the CLI:**
   ```bash
   cd /Users/agavr/projects/Backlog.md/agents
   bun install
   bun run build
   ```

2. **Make it globally available (optional):**
   ```bash
   # Link to global bin
   chmod +x dist/cli.js
   ln -sf "$(pwd)/dist/cli.js" /usr/local/bin/agents
   ```

## Usage

### Demo Mode (Simulated Agents)
Test the conversation flow with mock responses:
```bash
bun run demo
```

### Real Multi-Agent Mode
Start collaborative session with real agents:
```bash
# Default session (Claude + Gemini)
bun run dev

# Add Codex manually
bun run dev --agents claude,gemini,codex

# Use specific agents only
bun run dev --agents claude
bun run dev --agents gemini,codex

# Get help on specific topic
bun run dev help "How to optimize React performance"
```

### Commands Available in Chat Mode
- `exit` - Quit the session
- `clear` - Clear conversation history
- `status` - Show active agents
- Any other text - Send to all agents for collaborative response

## Architecture

The CLI creates a shared conversation context where:
1. **Claude** and **Gemini** run by default (Codex available manually with `--agents` flag)
2. All agents can see the full conversation history
3. All agents respond to each message, building on each other's insights
4. All responses are preserved for context in future exchanges
5. Conversation state is persisted to temporary files for debugging

## Requirements

- **Bun** runtime
- **Claude CLI** (`claude` command available)
- **Gemini CLI** (`gemini` command available)
- **Codex CLI** (`codex` command available - optional)

## Intelligent Fallback

The CLI automatically detects if real agent CLIs are available:

- **Real CLIs Available**: Uses actual Claude, Gemini, or Codex responses
- **CLIs Not Available**: Automatically falls back to intelligent simulated responses
- **Partial Availability**: Can mix real and simulated agents as needed
- **Graceful Degradation**: Always provides responses, never hangs or crashes

## Troubleshooting

The CLI is designed to work even if agent CLIs aren't properly configured:

1. **First time setup**: The CLI will test each agent and use fallbacks as needed
2. **Authentication issues**: Fallback responses ensure the CLI always works
3. **Network problems**: Local fallback responses don't require internet
4. **Missing CLIs**: Simulated responses let you test the conversation flow
5. **Mixed scenarios**: You can have some real agents and some simulated ones

### Testing Steps:
1. `bun run demo` - Pure simulation mode (always works)
2. `bun run dev` - Intelligent real/fallback hybrid mode
3. Check logs to see which agents are using fallback responses