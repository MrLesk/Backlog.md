# CLI Reference

Full command reference for Backlog.md. For getting started, see [README.md](README.md).

## Project Setup

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Initialize project | `backlog init [project-name]` (creates backlog structure with a minimal interactive flow) |
| Re-initialize | `backlog init` (preserves existing config, allows updates) |
| Advanced settings wizard | `backlog config` (no args) — launches the full interactive configuration flow |

`backlog init` keeps first-run setup focused on the essentials:
- **Project name** – identifier for your backlog (defaults to the current directory on re-run).
- **Backlog folder** – choose `backlog/`, `.backlog/`, or a custom project-relative path.
- **Config location** – for built-in folders, choose folder-local `config.yml` or root `backlog.config.yml`; custom paths use root `backlog.config.yml`.
- **Integration choice** – decide whether your AI tools use **CLI instructions** (recommended), the optional **MCP connector**, or no AI setup.
- **Instruction files (CLI path)** – the CLI setup writes a short nudge to AGENTS.md by default in non-interactive setup. Interactive setup lets you choose CLAUDE.md, AGENTS.md, GEMINI.md, Copilot instructions, or skip.
- **Advanced settings prompt** – default answer "No" finishes init immediately; choosing "Yes" jumps straight into the advanced wizard documented in [ADVANCED-CONFIG.md](ADVANCED-CONFIG.md).

The advanced wizard includes interactive Definition of Done defaults editing (add/remove/reorder/clear), so project checklist defaults can be managed without manual YAML edits.

You can rerun the wizard anytime with `backlog config`. All existing CLI flags (for example `--defaults`, `--agent-instructions`) continue to provide fully non-interactive setups, and init also supports `--backlog-dir <path>` plus `--config-location <folder|root>` for scripted configuration.

Humans and agents can run `backlog instructions` for workflow guides and `backlog instructions overview` for the overview.

## Documentation

- Document IDs are global across all subdirectories under `backlog/docs`. You can organize files in nested folders (e.g., `backlog/docs/guides/`), and `backlog doc list` and `backlog doc view <id>` work across the entire tree.
- Use `backlog doc create "New Guide" -p guides` to create a document in a docs subdirectory. The created output includes the persisted docs-relative file path, such as `backlog/docs/guides/doc-1 - New-Guide.md`.
- Use `backlog doc update doc-1 --content "Updated markdown"` to update document content. Add `--title`, `-t/--type`, `--tags`, or `-p/--path` to update metadata or move the document while preserving omitted fields.
- Use `backlog doc search "query"` for scoped document search with plain text output that includes document IDs and follow-up `backlog doc view <docId>` commands. Use `--limit <number>` to cap results.
- Document paths are always relative to the docs directory. Absolute paths and traversal segments such as `..` are rejected.

## Task Management

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create task | `backlog task create "Add OAuth System"`                    |
| Create with description | `backlog task create "Feature" -d "Add authentication system"` |
| Create with assignee | `backlog task create "Feature" -a @sara`           |
| Create with status | `backlog task create "Feature" -s "In Progress"`    |
| Create with labels | `backlog task create "Feature" -l auth,backend`     |
| Create with priority | `backlog task create "Feature" --priority high`     |
| Create with plan | `backlog task create "Feature" --plan "1. Research\n2. Implement"`     |
| Create with AC | `backlog task create "Feature" --ac "Must work,Must be tested"` |
| Add DoD items on create | `backlog task create "Feature" --dod "Run tests"` |
| Create without DoD defaults | `backlog task create "Feature" --no-dod-defaults` |
| Create with notes | `backlog task create "Feature" --notes "Started initial research"` |
| Create with final summary | `backlog task create "Feature" --final-summary "Completion summary"` |
| Create with deps | `backlog task create "Feature" --dep task-1,task-2` |
| Create with refs | `backlog task create "Feature" --ref https://docs.example.com --ref src/api.ts` |
| Create with docs | `backlog task create "Feature" --doc https://design-docs.example.com --doc docs/spec.md` |
| Create sub task | `backlog task create -p 14 "Add Login with Google"`|
| Create (all options) | `backlog task create "Feature" -d "Description" -a @sara -s "To Do" -l auth --priority high --ac "Must work" --notes "Initial setup done" --dep task-1 --ref src/api.ts --doc docs/spec.md -p 14` |
| List tasks  | `backlog task list [-s <status>] [-a <assignee>] [-p <parent>] [--labels <labels>] [--search <query>] [--limit <n>]` |
| List filtered | `backlog task list --labels frontend,bug --search "login" --limit 10 --plain` |
| List by parent | `backlog task list --parent 42` or `backlog task list -p task-42` |
| View detail | `backlog task 7` (interactive UI, press 'E' to edit in editor) |
| View (AI mode) | `backlog task 7 --plain`                           |
| Edit        | `backlog task edit 7 -a @sara -l auth,backend`       |
| Add plan    | `backlog task edit 7 --plan "Implementation approach"`    |
| Add AC      | `backlog task edit 7 --ac "New criterion" --ac "Another one"` |
| Add DoD     | `backlog task edit 7 --dod "Ship notes"` |
| Remove AC   | `backlog task edit 7 --remove-ac 2` (removes AC #2)      |
| Remove multiple ACs | `backlog task edit 7 --remove-ac 2 --remove-ac 4` (removes AC #2 and #4) |
| Check AC    | `backlog task edit 7 --check-ac 1` (marks AC #1 as done) |
| Check DoD   | `backlog task edit 7 --check-dod 1` (marks DoD #1 as done) |
| Check multiple ACs | `backlog task edit 7 --check-ac 1 --check-ac 3` (marks AC #1 and #3 as done) |
| Uncheck AC  | `backlog task edit 7 --uncheck-ac 3` (marks AC #3 as not done) |
| Uncheck DoD | `backlog task edit 7 --uncheck-dod 3` (marks DoD #3 as not done) |
| Mixed AC operations | `backlog task edit 7 --check-ac 1 --uncheck-ac 2 --remove-ac 4` |
| Mixed DoD operations | `backlog task edit 7 --check-dod 1 --uncheck-dod 2 --remove-dod 4` |
| Add notes   | `backlog task edit 7 --notes "Completed X, working on Y"` (replaces existing) |
| Append notes | `backlog task edit 7 --append-notes "New findings"` |
| Add comment | `backlog task edit 7 --comment "Question for review" --comment-author @sara` |
| Add final summary | `backlog task edit 7 --final-summary "Completion summary"` |
| Append final summary | `backlog task edit 7 --append-final-summary "More details"` |
| Clear final summary | `backlog task edit 7 --clear-final-summary` |
| Add deps    | `backlog task edit 7 --dep task-1 --dep task-2`     |
| Archive     | `backlog task archive 7`                             |

Task comments are append-only discussion entries with optional author labels. Use comments for review questions and collaboration notes; use implementation notes for execution progress and final summary for PR-ready completion notes.

### Multi-line input (description/plan/notes/comments/final summary)

The CLI preserves input literally — `\n` sequences are not auto-converted. Use one of the following forms (recommended order for AI agents):

**1. Repeat `--append-*` for each line (works in every shell, including Claude Code / Codex / agent sandboxes):**

```bash
backlog task edit 7 --notes "First line"
backlog task edit 7 --append-notes "Second line"
backlog task edit 7 --append-notes "Third line"
```

**2. Real newlines inside double quotes (single command):**

```bash
backlog task create "Feature" --desc "Line1
Line2

Final paragraph"
```

The same shape works for `--plan`, `--notes`, `--comment`, `--final-summary`, and the `--append-*` variants.

**3. Shell-specific shorthand (interactive shells only — rejected by tree-sitter-based agent sandboxes, see [#595](https://github.com/MrLesk/Backlog.md/issues/595)):**

- **Bash/Zsh (ANSI-C quoting)**

  ```bash
  backlog task edit 7 --notes $'Line1\nLine2'
  ```

- **POSIX sh (printf substitution)**

  ```bash
  backlog task create "Feature" --desc "$(printf 'Line1\nLine2\n\nFinal paragraph')"
  ```

- **PowerShell (backtick-n)**

  ```powershell
  backlog task create "Feature" --desc "Line1`nLine2`n`nFinal paragraph"
  ```

## Milestone Management

Milestones are managed through milestone files. Use CLI commands instead of editing milestone markdown directly so IDs, filenames, task references, and archive state stay consistent.

| Action | Example |
|--------|---------|
| List milestones | `backlog milestone list --plain` |
| List completed milestones too | `backlog milestone list --show-completed --plain` |
| Add milestone | `backlog milestone add "Release 1.0"` |
| Add with description | `backlog milestone add "Beta" --description "Beta scope"` |
| Rename and update tasks | `backlog milestone rename "Release 1.0" "Release 2.0"` |
| Rename without task updates | `backlog milestone rename m-1 "Release 2.0" --no-update-tasks` |
| Remove and clear task milestones | `backlog milestone remove "Release 1.0"` |
| Remove and keep task values | `backlog milestone remove "Release 1.0" --task-handling keep` |
| Remove and reassign tasks | `backlog milestone remove "Release 1.0" --task-handling reassign --reassign-to "Release 2.0"` |
| Archive milestone | `backlog milestone archive m-1` |

`milestone remove` task handling modes are `clear` (default), `keep`, and `reassign`. `--reassign-to` is required when using `--task-handling reassign`, and the target must be an active milestone file.

## Search

Find tasks, documents, and decisions across your entire backlog with fuzzy search:

| Action             | Example                                              |
|--------------------|------------------------------------------------------|
| Search tasks       | `backlog search "auth"`                        |
| Filter by status   | `backlog search "api" --status "In Progress"`   |
| Filter by priority | `backlog search "bug" --priority high`        |
| Combine filters    | `backlog search "web" --status "To Do" --priority medium` |
| Plain text output  | `backlog search "feature" --plain` (for scripts/AI) |

**Search features:**
- **Fuzzy matching** -- finds "authentication" when searching for "auth"
- **Interactive filters** -- refine your search in real-time with the TUI
- **Live filtering** -- see results update as you type (no Enter needed)

## Draft Workflow

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create draft | `backlog task create "Feature" --draft`             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

## Dependency Management

Manage task dependencies to create execution sequences and prevent circular relationships:

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Add dependencies | `backlog task edit 7 --dep task-1 --dep task-2`     |
| Add multiple deps | `backlog task edit 7 --dep task-1,task-5,task-9`    |
| Create with deps | `backlog task create "Feature" --dep task-1,task-2` |
| View dependencies | `backlog task 7` (shows dependencies in task view)  |
| Validate dependencies | Use task commands to automatically validate dependencies |

**Dependency Features:**
- **Automatic validation**: Prevents circular dependencies and validates task existence
- **Flexible formats**: Use `task-1`, `1`, or comma-separated lists like `1,2,3`
- **Visual sequences**: Dependencies create visual execution sequences in board view
- **Completion tracking**: See which dependencies are blocking task progress

## Board Operations

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Kanban board      | `backlog board` (interactive UI, press 'E' to edit in editor) |
| Export board | `backlog board export [file]` (exports Kanban board to markdown) |
| Export with version | `backlog board export --export-version "v1.0.0"` (includes version in export) |

## Statistics & Overview

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Project overview | `backlog overview` (interactive TUI showing project statistics) |

## Web Interface

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Web interface | `backlog browser` (launches web UI on port 6420) |
| Web custom port | `backlog browser --port 8080 --no-open` |

To keep the Web UI running in the background with auto-start on boot, see [Running Backlog.md as a Service](backlog/docs/doc-003%20-%20Running-Backlog-Browser-as-a-Service.md).

## Documentation

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create doc | `backlog doc create "API Guidelines"` |
| Create with path | `backlog doc create "Setup Guide" -p guides/setup` |
| Create with type | `backlog doc create "Architecture" -t guide` |
| Update content | `backlog doc update doc-1 --content "Updated markdown"` |
| Update metadata/path | `backlog doc update doc-1 --title "Setup Handbook" -t guide --tags setup,runbook -p guides` |
| List docs | `backlog doc list` |
| Search docs | `backlog doc search "architecture" --limit 5` |
| View doc | `backlog doc view doc-1` |

## Decisions

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create decision | `backlog decision create "Use PostgreSQL for primary database"` |
| Create with status | `backlog decision create "Migrate to TypeScript" -s proposed` |

## Agent Instructions

| Action                                          | Example                                              |
|-------------------------------------------------|------------------------------------------------------|
| Open the local CLI documentation entry point | `backlog` |
| List workflow guides | `backlog instructions` |
| Required first read for task workflow | `backlog instructions overview` |
| Read a detailed workflow guide | `backlog instructions task-execution` |
| Update CLI agent instruction files | `backlog agents --update-instructions` (updates CLAUDE.md, AGENTS.md, GEMINI.md, .github/copilot-instructions.md) |

## Maintenance

| Action      | Example                                                                                      |
|-------------|----------------------------------------------------------------------------------------------|
| Cleanup done tasks | `backlog cleanup` (move old completed tasks to completed folder to cleanup the kanban board) |

Full help: `backlog --help`

---

## Sharing & Export

### Board Export

Export your Kanban board to a clean, shareable markdown file:

```bash
# Export to default Backlog.md file
backlog board export

# Export to custom file
backlog board export project-status.md

# Force overwrite existing file
backlog board export --force

# Export to README.md with board markers
backlog board export --readme

# Include a custom version string in the export
backlog board export --export-version "v1.2.3"
backlog board export --readme --export-version "Release 2024.12.1-beta"
```

Perfect for sharing project status, creating reports, or storing snapshots in version control.

---

## Shell Tab Completion

Backlog.md can install tab completion for bash, zsh, fish, and PowerShell.

**Quick Installation:**
```bash
# Auto-detect and install for your current shell
backlog completion install

# Or specify shell explicitly
backlog completion install --shell bash
backlog completion install --shell zsh
backlog completion install --shell fish
backlog completion install --shell pwsh
```

**What you get:**
- Command completion: `backlog <TAB>` → shows all commands
- Dynamic task IDs: `backlog task edit <TAB>` → shows actual task IDs from your backlog
- Smart flags: `--status <TAB>` → shows configured status values
- Context-aware suggestions for priorities, labels, and assignees

Full documentation: See [completions/README.md](completions/README.md) for detailed installation instructions, troubleshooting, and examples.
