
When you're working on a task, you should assign it yourself: -a @{your-name}

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

## Agent POV

- Treat Backlog.md as a shipped CLI/MCP binary that may be used from other repositories where agents cannot inspect this source tree.
- Backlog.md is not a supported JavaScript or TypeScript library API for external consumers. Do not treat exported source symbols, classes, or methods in `/src` as stable public interfaces unless they are explicitly documented in shipped CLI/MCP/instruction surfaces.
- When you decide what another agent can rely on, use only the public surface: MCP workflow resources, MCP tool descriptions/schemas, CLI help, and instruction files shipped with the project.
- Do not assume external agents know internal implementation details, constants, or source-only conventions.
- When reviewing changes, do not ask for compatibility shims just because a source-level method exists or was removed. Only preserve compatibility for behavior that is part of the documented CLI, MCP, config, or instruction contract.
- If a convention matters for agent behavior, document it in the public MCP/instruction surface rather than relying on source-code discovery.

## Maintainer Workflow Guardrails

- Treat GitHub issues as reports, proposals, or evidence, not implementation specs. Do not automatically implement the requested solution; first evaluate whether the change fits Backlog.md's public CLI/MCP/instruction surface and current documented behavior.
- Escalate ambiguous product behavior to Alex before implementation. For example, pause before deciding whether ordinal-only task ordering changes should update edit metadata.
- PRs should normally link to a scoped issue first. If a broad feature PR or request has no issue, ask for an issue or discussion before implementation rather than turning the PR into the scope definition.
- Investigations should not create implementation PRs by default. Leave findings as comments, reports, or notes unless a narrow accepted fix is clear.
- Use the documented `backlog task create` workflow for task creation. Do not manually edit task files, pick IDs, pre-reserve IDs, or create coordination-only IDs as a workaround; rely on the CLI allocator and lock to assign task IDs.
- When acting publicly on Alex's behalf, use neutral maintainer language and identify yourself as `Alex's Agent:` if identification is needed. Do not reveal private strategy, roadmap, or status framing; keep scope decisions grounded in the project's public docs and shipped behavior.
- When evaluating issue or PR compatibility, rely on the stable public surface only: CLI behavior, MCP tools/resources, configuration, and shipped instructions. Internal TypeScript exports are implementation details unless public docs explicitly promise them.

## Code Standards

- **Runtime**: Bun with TypeScript 5
- **Formatting**: Biome with tab indentation and double quotes
- **Linting**: Biome recommended rules
- **Testing**: Bun's built-in test runner
- **Pre-commit**: Husky + lint-staged automatically runs Biome checks before commits

The pre-commit hook automatically runs `biome check --write` on staged files to ensure code quality. If linting errors
are found, the commit will be blocked until fixed.

## Git Workflow

- **Branching**: Use feature branches when working on tasks (e.g. `tasks/back-123-feature-name`)
- **Committing**: Use the following format: `BACK-123 - Title of the task`
- **PR titles**: Use `{taskId} - {taskTitle}` (e.g. `BACK-123 - Title of the task`)
- **Github CLI**: Use `gh` whenever possible for PRs and issues

<!-- BACKLOG.MD GUIDELINES START -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Use the detailed guides when needed:
- `backlog instructions task-creation` for creating or splitting tasks
- `backlog instructions task-execution` for planning and implementation workflow
- `backlog instructions task-finalization` for completion and handoff

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
