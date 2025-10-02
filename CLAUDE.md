# ⚠️ **IMPORTANT**

Read the [agent-guidelines.md](src/guidelines/agent-guidelines.md)

## Commands

### Development
- `bun i` - Install dependencies (configures smart CLI detection)
- `bun run build` - Build the CLI tool
- `bun run cli` - Use CLI directly
- `bun link` - Create global symlink (works with smart detection)

### Testing & Quality
- `CLAUDECODE=1 bun test` - Run all tests with failures-only output (RECOMMENDED - full output is too long for Claude)
- `bun test <filename>` - Run specific test file
- `bun test src/**/*.test.ts` - Unit tests only
- `bun test src/mcp/**/*.test.ts` - MCP tests only
- `bun test --watch` - Run tests in watch mode
- `bunx tsc --noEmit` - Type-check code
- `bun run check .` - Run all Biome checks (format + lint)

**Development Strategy**: Test specific files during development, run full suite before commits.
**Important**: Always use `CLAUDECODE=1` when running full test suite - the default verbose output exceeds Claude's consumption limits.

### Performance Benchmarking
- `bun run benchmark` - Run performance benchmark on all test files
  - Runs each test file individually and measures execution time
  - Groups results by test prefix (mcp-, cli-, board-, etc.)
  - Generates `test-benchmark-report.json` with detailed timing data
  - Shows top 10 slowest tests and performance breakdown by category

### Pre-Commit Validation (REQUIRED)
**Claude MUST verify all pass before committing:**
```bash
bunx tsc --noEmit                      # TypeScript compilation
bun run check .                        # Lint/format
CLAUDECODE=1 bun test --timeout 180000 # Full test suite (failures-only output)
```

### CLI Development Workflow
The project includes smart CLI detection that eliminates common development friction:

1. **Fresh Clone**: `git clone` → `bun install` → `bun link` - works immediately
2. **Auto-Detection**: CLI automatically uses TypeScript source files in development
3. **No Version Conflicts**: Always runs your current development code

#### Debug & Manual Override
```bash
# Debug detection
BACKLOG_DEBUG=true backlog --version

# Force specific execution modes
BACKLOG_EXECUTION_MODE=development backlog --version  # Uses bun src/cli.ts
BACKLOG_EXECUTION_MODE=built backlog --version        # Uses dist/backlog
BACKLOG_EXECUTION_MODE=production backlog --version   # Uses platform binary

# Disable smart detection (if needed)
BACKLOG_SMART_CLI=false backlog --version
```

#### Common Issues & Solutions
**❌ "Unknown command" error after `bun link`:**
```bash
BACKLOG_EXECUTION_MODE=development backlog --version  # Usually fixes the issue
```

**❌ Using wrong version after linking:**
```bash
BACKLOG_DEBUG=true backlog --version  # Should show "Is globally linked: true"
```

### Configuration
- `bun run cli config list` - View all configuration values
- `bun run cli config get <key>` - Get specific value (e.g. defaultEditor)
- `bun run cli config set <key> <value>` - Set with validation

## Core Structure
- **CLI Tool**: Built with Bun and TypeScript as a global npm package (`npm i -g backlog.md`)
- **Source Code**: Located in `/src` directory with modular TypeScript structure
- **Task Management**: Uses markdown files in `backlog/` directory structure
- **Git Workflow**: Task IDs referenced in commits and PRs (`TASK-123 - Title`)
  - **Branching**: Use feature branches when working on tasks (e.g. `tasks/task-123-feature-name`)

## Code Standards
- **Runtime**: Bun with TypeScript 5
- **Formatting**: Biome with tab indentation and double quotes
- **Linting**: Biome recommended rules
- **Testing**: Bun's built-in test runner
- **Pre-commit**: Husky + lint-staged automatically runs Biome checks before commits

The pre-commit hook automatically runs `biome check --write` on staged files to ensure code quality. If linting errors are found, the commit will be blocked until fixed.

## Architecture Guidelines
- **Separation of Concerns**: CLI logic and utility functions are kept separate to avoid side effects during testing
- **Utility Functions**: Reusable utility functions (like ID generators) are placed in `src/utils/` directory
- **No Side Effects on Import**: Modules should not execute CLI code when imported by other modules or tests
- **Branching**: Use feature branches when working on tasks (e.g. `tasks/task-123-feature-name`)
- **Committing**: Use the following format: `TASK-123 - Title of the task`
- **Github CLI**: Use `gh` whenever possible for PRs and issues

## MCP Architecture Principles
- **MCP is a Pure Protocol Wrapper**: Protocol translation ONLY - no business logic, no feature extensions
- **CLI Feature Parity**: MCP = strict subset of CLI capabilities
- **Core API Usage**: All operations MUST use Core APIs (never direct filesystem/git)
- **Shared Utilities**: Reuse exact same utilities as CLI (`src/utils/task-builders.ts`)
- **🔒 Local Development Only**: localhost-only (see [/docs/mcp/SECURITY.md](docs/mcp/SECURITY.md))

**Violations to Avoid**:
- Custom business logic in MCP handlers
- Direct filesystem or git operations
- Features beyond CLI capabilities

See MCP implementation in `/src/mcp/` for development details.

## CLI Multi-line Input (description/plan/notes)
The CLI preserves input literally; `\n` sequences in normal quotes are not converted. Use one of the following when you need real newlines:

- **Bash/Zsh (ANSI‑C quoting)**:
  - `backlog task edit 42 --notes $'Line1\nLine2'`
  - `backlog task edit 42 --plan $'1. A\n2. B'`
- **POSIX (printf)**:
  - `backlog task edit 42 --desc "$(printf 'Line1\nLine2')"`
- **PowerShell (backtick)**:
  - `backlog task edit 42 --desc "Line1\`nLine2"`

*Note: `"...\n..."` passes literal backslash+n, not newline*

## Using Bun
Default to using Bun instead of Node.js:

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv
- Run `bunx tsc --noEmit` to perform TypeScript compilation checks as often as convenient

### Key APIs
- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`
- `Bun.redis` for Redis. Don't use `ioredis`
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`
- `WebSocket` is built-in. Don't use `ws`
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa

## Frontend Development
Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

### Build Commands (/src/web/)
- `bun run build:css` - Build Tailwind CSS
- `bun run build` - Build CSS + compile CLI binary

### Architecture
- **HTML Imports**: Use `Bun.serve()` with direct .tsx/.jsx imports (no bundler needed)
- **CSS**: Tailwind CSS processed via `@tailwindcss/cli`
- **React**: Components in `/src/web/components/`, contexts in `/src/web/contexts/`
- **Bundling**: Bun handles .tsx/.jsx transpilation automatically

### Server Example
```ts
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
    open: (ws) => { ws.send("Hello, world!"); },
    message: (ws, message) => { ws.send(message); },
    close: (ws) => { /* handle close */ }
  },
  development: { hmr: true, console: true }
})
```

### Frontend Component Example
HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically:

```html
<!-- index.html -->
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

```tsx
// frontend.tsx
import React from "react";
import './index.css';  // CSS imports work directly
import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Run with: `bun --hot ./index.ts`

## Testing
Use `bun test` to run tests:

```ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.