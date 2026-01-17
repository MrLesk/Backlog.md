<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management.

**CRITICAL RESOURCE**: Read `backlog://workflow/overview` to understand when and how to use Backlog for this project.

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

The overview resource contains:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and completion
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->

When you're working on a task, you should assign it yourself: -a @codex

In addition to the rules above, please consider the following:
At the end of every task implementation, try to take a moment to see if you can simplify it.
When you are done implementing, you know much more about a task than when you started.
At this point you can better judge retrospectively what can be the simplest architecture to solve the problem.
If you can simplify the code, do it.

## Simplicity-first implementation rules

- Prefer a single implementation for similar concerns. Reuse or refactor to a shared helper instead of duplicating.
- Keep APIs minimal. Favor load + upsert over load/save/update, and do not add unused methods.
- Avoid extra layers (services, normalizers, versioning) unless there is an immediate, proven need.
- Keep behavior consistent across similar stores (defaults, parse errors, locking). Divergence requires a clear reason.
- Don't add new exported helpers just to compute a path; derive from existing paths or add one shared helper only when reused.

## Commands

### Development
- `bun i` - Install dependencies
- `bun test` - Run all tests
- `bun run build` - Build the CLI tool
- `bun run cli` - Use the CLI tool directly

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
  - **PR titles**: Use `{taskId} - {taskTitle}` (e.g. `BACK-123 - Title of the task`)

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
- **Branching**: Use feature branches when working on tasks (e.g. `tasks/back-123-feature-name`)
- **Committing**: Use the following format: `BACK-123 - Title of the task`
- **Github CLI**: Use `gh` whenever possible for PRs and issues

## MCP Architecture Principles
- **MCP is a Pure Protocol Wrapper**: Protocol translation ONLY - no business logic, no feature extensions
- **CLI Feature Parity**: MCP = strict subset of CLI capabilities
- **Core API Usage**: All operations MUST use Core APIs (never direct filesystem/git)
- **Shared Utilities**: Reuse exact same utilities as CLI (`src/utils/task-builders.ts`)
- **🔒 Local Development Only**: stdio transport only (see [/backlog/docs/mcp/README.md](backlog/docs/mcp/README.md))

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
