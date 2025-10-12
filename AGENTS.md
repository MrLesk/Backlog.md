<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

Your Role: You are an expert software engineering agent interacting with a project managed by Backlog.md.

IMMEDIATE ACTION REQUIRED: BACKLOG INSTRUCTIONS DISCOVERY

This project uses the Backlog.md MCP (Model Context Protocol) tool for all project and task management. This system has a specific,
machine-readable instructions that you MUST learn before taking any other action.

1. STOP. Do not run any other commands or tools until you know how to use Backlog.md.
2. Backlog MCP Server is already configured. When you connect, IMMEDIATELY call the `read_backlog_instructions` tool and read the workflow it returns.
3. If you were previously connected, then you should already have the instructions cached. They start with "## Backlog.md Overview (MCP) Instructions".
4. The server itself contains the instructions. They are available exclusively through the `read_backlog_instructions` tool.
5. READ and FOLLOW the instructions returned by `read_backlog_instructions`. They are your primary guide for all subsequent
   actions in this project.

FAILURE TO FOLLOW THIS PROTOCOL WILL RESULT IN TASK FAILURE. All other tools and commands are secondary to the
instructions provided by the Backlog.md MCP. Do not proceed until you have completed the instructions discovery.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->

When you're working on a task, you should assign it yourself: -a @codex

In addition to the rules above, please consider the following:
At the end of every task implementation, try to take a moment to see if you can simplify it. 
When you are done implementing, you know much more about a task than when you started.
At this point you can better judge retrospectively what can be the simplest architecture to solve the problem.
If you can simplify the code, do it.

## Commands

### Development

- `bun i` - Install dependencies
- `bun test` - Run all tests
- `bunx tsc --noEmit` - Type-check code
- `bun run check .` - Run all Biome checks (format + lint)
- `bun run build` - Build the CLI tool
- `bun run cli` - Uses the CLI tool directly

### Testing

- `bun test` - Run all tests
- `bun test <filename>` - Run specific test file

### Configuration Management

- `bun run cli config list` - View all configuration values
- `bun run cli config get <key>` - Get a specific config value (e.g. defaultEditor)
- `bun run cli config set <key> <value>` - Set a config value with validation

## Core Structure

- **CLI Tool**: Built with Bun and TypeScript as a global npm package (`npm i -g backlog.md`)
- **Source Code**: Located in `/src` directory with modular TypeScript structure
- **Task Management**: Uses markdown files in `backlog/` directory structure
- **Workflow**: Git-integrated with task IDs referenced in commits and PRs

## Code Standards

- **Runtime**: Bun with TypeScript 5
- **Formatting**: Biome with tab indentation and double quotes
- **Linting**: Biome recommended rules
- **Testing**: Bun's built-in test runner
- **Pre-commit**: Husky + lint-staged automatically runs Biome checks before commits

The pre-commit hook automatically runs `biome check --write` on staged files to ensure code quality. If linting errors
are found, the commit will be blocked until fixed.

## Git Workflow

- **Branching**: Use feature branches when working on tasks (e.g. `tasks/task-123-feature-name`)
- **Committing**: Use the following format: `TASK-123 - Title of the task`
- **Github CLI**: Use `gh` whenever possible for PRs and issues

