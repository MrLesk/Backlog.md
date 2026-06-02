---
id: BACK-474
title: Add wiki install command
status: Done
assignee: 
  - Kimi
created_date: '2026-05-07 14:51'
updated_date: '2026-05-07 15:17'
labels:
  - feature
  - cli
  - wiki
dependencies: []
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a `backlog wiki install <agent>` CLI command to install the built-in `llm-wiki-for-backlog` skill into the specified Agent's Skills directory.

The skill source is fixed at `.codex/skills/llm-wiki-for-backlog/` within the current project (contains `SKILL.md` along with `references/`, `scripts/`, and other assets). Since the CLI is distributed as a compiled executable (`dist/backlog` via `bun build --compile`), these skill files must be **embedded into the binary at build time** so they remain available when the source tree is not present.

The command should:
1. Accept an Agent name argument, mapped via aliases to the corresponding Skills directory. Only support Agents with **explicit Skills directory support**: `claude`, `codex`, `agents`
2. Copy the embedded `llm-wiki-for-backlog` skill files into the target Agent's `skills/llm-wiki-for-backlog/` directory
3. Provide an overwrite or skip option when the skill already exists (`--force`)
4. Support `--dry-run` to preview operations without writing
5. Output installation results and skill summary info (extract `name`, `description`, `trigger` from SKILL.md YAML frontmatter)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Design Reference: `--agent-instructions` and `installClaudeAgent()` Implementation Pattern

Research shows the existing CLI handles Agents using **hard-coded alias mapping + explicit directory writing**, not dynamic scanning. BACK-474 should follow the same pattern for consistency:

### Skill Embedding Strategy

Since the CLI is compiled into a standalone executable (`bun build --production --compile --outfile=dist/backlog src/cli.ts`), the skill files under `.codex/skills/llm-wiki-for-backlog/` cannot be read from the filesystem at runtime. Two approaches exist in the codebase:

**Approach A: Build-time code generation (Recommended)**
- Add a pre-build script (e.g., `scripts/embed-wiki-skill.ts`) that scans `.codex/skills/llm-wiki-for-backlog/` recursively
- Generate `src/skills/embedded/llm-wiki-for-backlog.ts` exporting a `Record<string, string>` map of relative paths to file contents
- Reference this generated module from the wiki install command
- Add the script to the `build` pipeline before `bun build`

**Approach B: Individual `import with { type: "text" }` imports**
- Reference `src/guidelines/index.ts` which uses `import content from "./file.md" with { type: "text" }` to inline single files
- For a directory with subdirectories, this requires one import per file and a manual path mapping
- Less maintainable when skill contents change

**Recommended**: Approach A, as it scales with skill content changes and mirrors the intent of `import with { type: "text" }` while handling directories.

### Agent Alias Mapping

Only Agents with explicit Skills directory support are implemented. Others (`cursor`, `gemini`, `copilot`) are rejected with a clear error.

| Alias | Skills directory | Rationale |
|-------|-----------------|-----------|
| `claude` | `.claude/skills/` | Claude Code natively supports `.claude/skills/` |
| `codex` | `.codex/skills/` | OpenAI Codex CLI natively supports `.codex/skills/` |
| `agents` | `.agents/skills/` | Generic fallback for multi-agent projects |

**Notes:**
- Invalid or unsupported aliases should produce a clear error listing valid options
- The mapping should be centralized (e.g., `src/utils/agent-skill-targets.ts`) so it can be reused if needed

2. **Directory Creation Logic** (Reference `src/agent-instructions.ts:263-272`)
   - `installClaudeAgent()` directly does `join(projectRoot, ".claude", "agents")` and `mkdir({ recursive: true })`
   - **BACK-474 should do the same**: directly `join(projectRoot, ".claude", "skills", skillName)`, without scanning or guessing directory structure
   - If the directory already exists, write directly; if the skill already exists, overwrite or error based on `--force`

3. **No Scanning, No Inference** (Consistent with existing CLI)
   - The `backlog agents` command does not scan whether `.claude/`, `.codex/`, etc. exist
   - **BACK-474 should also not scan**: the user explicitly specifies the target via alias, or defaults to `.claude/skills/`
   - To support additional Agents, simply extend the alias mapping later

### Skill File Handling

**Unified storage via symlink (primary approach):**

Skills are stored centrally under `.agents/skills/llm-wiki-for-backlog/`. Agent-specific directories (e.g., `.claude/skills/`, `.codex/skills/`) are **symbolic links** pointing to `.agents/skills/`.

```
.agents/skills/llm-wiki-for-backlog/
├── SKILL.md
├── references/
└── scripts/

.claude/skills → .agents/skills        (symlink)
.codex/skills → .agents/skills          (symlink)
```

**Why symlinks:**
- Single source of truth: skill files exist only once
- Updates affect all Agents immediately
- Cross-Agent consistency

**Installation logic per Agent:**
1. Write skill files to `.agents/skills/llm-wiki-for-backlog/` (create if missing)
2. Check if the Agent's skills path exists (e.g., `.claude/skills`):
   - Does not exist → create symlink to `.agents/skills`
   - Already a symlink pointing to `.agents/skills` → noop
   - Already a symlink pointing elsewhere → error (requires `--force` to replace)
   - Is a real directory with existing content → error (requires `--force` to replace with symlink)
3. When `--force` is passed, replace real directories / other symlinks with the correct symlink

**Windows compatibility:**
- Creating directory symlinks on Windows requires elevated privileges (administrator) unless Developer Mode is enabled
- If symlink creation fails on Windows, **fallback to direct copy** into the Agent's real directory (`.claude/skills/llm-wiki-for-backlog/`)
- Log a warning when fallback copy is used, informing the user that `.agents/skills/` is the preferred unified location

**Parse SKILL.md YAML frontmatter** to extract `name`, `description`, `trigger` for summary output.

**When `--dry-run` is passed**, list all files that would be written and symlinks that would be created, without making any changes.

### Command Draft
```
backlog wiki install <agent>
  --force              Overwrite existing skill or replace existing directory with symlink
  --dry-run            Preview operations without writing
```

Examples:
- `backlog wiki install claude` → Write to `.agents/skills/llm-wiki-for-backlog/`, create `.claude/skills → .agents/skills`
- `backlog wiki install codex` → Reuse `.agents/skills/`, create `.codex/skills → .agents/skills`
- `backlog wiki install claude --dry-run` → Preview files and symlinks to be created
- `backlog wiki install claude --force` → Replace existing `.claude/skills/` directory with symlink
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented `backlog wiki install <agent>` CLI command with the following components:

- **Build-time skill embedding**: `scripts/embed-wiki-skill.ts` scans `.codex/skills/llm-wiki-for-backlog/` and generates `src/skills/embedded/llm-wiki-for-backlog.ts`, ensuring skill files are available in the compiled binary.
- **Agent alias mapping**: Supports `claude` → `.claude/skills/`, `codex` → `.codex/skills/`, `agents` → `.agents/skills/` with centralized mapping in `src/commands/wiki-install.ts`.
- **Symlink architecture with graceful fallback**: Creates symlinks to `.agents/skills/` when the agent directory does not exist; uses existing directories directly if already present; falls back to direct copy on Windows when symlink creation fails.
- **Overwrite protection**: Rejects installing over an existing skill without `--force`; `--dry-run` previews all operations without writing.
- **Shell completion**: Added `agent` argument completions (`claude`, `codex`, `agents`) to `src/completions/helper.ts`.
- **Documentation**: Updated `src/guidelines/agent-guidelines.md` with the new command reference.
- **Tests**: 12 unit tests in `src/test/wiki-install.test.ts` covering resolveAgent, installWikiSkill, dry-run, force overwrite, symlink handling, and result formatting.

Files changed:
- `src/cli.ts` — register `backlog wiki install` command
- `src/commands/wiki-install.ts` — core implementation
- `src/test/wiki-install.test.ts` — unit tests
- `scripts/embed-wiki-skill.ts` — build-time embedding script
- `src/skills/embedded/llm-wiki-for-backlog.ts` — generated embedded module
- `src/completions/helper.ts` — shell completion for `<agent>` argument
- `src/guidelines/agent-guidelines.md` — agent instruction docs
- `package.json` — embed script in build pipeline
- `backlog/tasks/back-469 - Add-wiki-install-command.md` — this task
<!-- SECTION:FINAL_SUMMARY:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Support Agents with explicit Skills directory support: `claude`, `codex`, `agents`
- [x] #2 Auto-create the target Agent Skills directory (e.g., `.claude/skills/` if it does not exist)
- [x] #3 Provide `--dry-run` and `--force` options
- [x] #4 Display skill name, description, and trigger words after installation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
