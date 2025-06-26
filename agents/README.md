# Agents CLI

A multi-agent CLI tool that enables collaborative problem solving between AI agents (Claude and Gemini) in a shared terminal interface.

## Features

- **Multi-Agent Collaboration**: Claude and Gemini work together in the same conversation
- **Shared Context**: All agents see the full conversation history and can build on each other's responses
- **Real-time Interaction**: Type once, get responses from multiple AI perspectives
- **Problem Solving Focus**: Designed for collaborative technical problem solving

## Architecture

The CLI spawns both Claude and Gemini processes and manages a shared conversation state. When you type a message, both agents receive it and can respond, building on each other's insights.

## Usage

```bash
# Start collaborative session (default: Claude + Gemini)
agents

# Add Codex manually to session
agents --agents claude,gemini,codex

# Use specific agents only
agents --agents claude
agents --agents gemini,codex

# Get help from multiple agents on a specific topic  
agents help "How to optimize React performance"
```

## Development

```bash
bun install
bun dev
```