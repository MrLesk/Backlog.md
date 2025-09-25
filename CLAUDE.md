# ⚠️ **IMPORTANT**

Read the [agent-guidelines.md](src/guidelines/agent-guidelines.md)

## Commands

### Development

- `bun i` - Install dependencies (also configures smart CLI detection)
- `bun test` - Run all tests
- `bunx tsc --noEmit` - Type-check code
- `bun run check .` - Run all Biome checks (format + lint)
- `bun run build` - Build the CLI tool
- `bun run cli` - Uses the CLI tool directly
- `bun link` - Create global symlink (now works seamlessly with smart detection!)

### CLI Development Workflow

The project includes smart CLI detection that eliminates common development friction:

1. **Fresh Clone**: `git clone` → `bun install` → `bun link` - works immediately
2. **Auto-Detection**: CLI automatically uses TypeScript source files in development
3. **No Version Conflicts**: Always runs your current development code

#### Debug CLI Detection

```bash
export BACKLOG_DEBUG=true
backlog --version  # Shows detection mode and execution path
```

#### Manual Mode Override

```bash
# Force specific execution modes when needed
BACKLOG_EXECUTION_MODE=development backlog --version  # Uses bun src/cli.ts
BACKLOG_EXECUTION_MODE=built backlog --version        # Uses dist/backlog
BACKLOG_EXECUTION_MODE=production backlog --version   # Uses platform binary
```

#### Disable Smart Detection (if needed)

```bash
export BACKLOG_SMART_CLI=false
backlog --version  # Uses legacy platform binary behavior
```

#### Common Issues & Solutions

**❌ "Unknown command" error after `bun link`:**
```bash
# Force development mode - usually fixes the issue
BACKLOG_EXECUTION_MODE=development backlog --version
```

**❌ Using wrong version after linking:**
```bash
# Check if detection is working correctly
BACKLOG_DEBUG=true backlog --version
# Should show "Is globally linked: true" and use development mode
```

### Testing

- `bun test` - Run all tests
- `bun test <filename>` - Run specific test file
- `bun test src/**/*.test.ts` - Run only unit tests (or use `npm run test:unit`)
- `bun test src/mcp/**/*.test.ts` - Run only MCP tests (or use `npm run test:mcp`)
- `bun test --watch` - Run tests in watch mode (or use `npm run test:watch`)

### Performance Benchmarking

- `bun run benchmark` - Run performance benchmark on all test files
  - Runs each test file individually and measures execution time
  - Groups results by test prefix (mcp-, cli-, board-, etc.)
  - Generates `test-benchmark-report.json` with detailed timing data
  - Shows top 10 slowest tests and performance breakdown by category
  - Useful for tracking test performance improvements and identifying bottlenecks

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

## Architecture Guidelines

- **Separation of Concerns**: CLI logic and utility functions are kept separate to avoid side effects during testing
- **Utility Functions**: Reusable utility functions (like ID generators) are placed in `src/utils/` directory
- **No Side Effects on Import**: Modules should not execute CLI code when imported by other modules or tests

## MCP Architecture Principles

- **MCP is a Pure Wrapper**: MCP server provides protocol translation ONLY - no business logic, no feature extensions
- **CLI Feature Parity**: MCP cannot have features that CLI doesn't have. It's a strict subset of CLI functionality
- **Core API Usage**: All operations MUST use Core APIs
- **No Direct Filesystem**: All file operations through Core's filesystem abstraction
- **Architectural Violations to Avoid**:
  - Custom business logic in MCP handlers
  - Features beyond CLI capabilities
  - Reimplemented Core functionality
  - Direct filesystem or git operations

## Git Workflow

- **Branching**: Use feature branches when working on tasks (e.g. `tasks/task-123-feature-name`)
- **Committing**: Use the following format: `TASK-123 - Title of the task`

## CLI multi‑line input (description/plan/notes)

The CLI preserves input literally; `\n` sequences in normal quotes are not converted. Use one of the following when you need real newlines:

- Bash/Zsh (ANSI‑C quoting):
  - `backlog task edit 42 --notes $'Line1\nLine2'`
  - `backlog task edit 42 --plan $'1. A\n2. B'`
- POSIX (printf):
  - `backlog task edit 42 --desc "$(printf 'Line1\nLine2')"`
- PowerShell (backtick):
  - `backlog task edit 42 --desc "Line1`nLine2"`

Do not expect `"...\n..."` to create a newline; that passes a literal backslash+n.

## Using Bun
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.
- Run `bunx tsc --noEmit` to perform Typescript compilation checks as often as convenient.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
