<h1 align="center">Backlog.md</h1>
<p align="center">Markdown‑native Task Manager &amp; Kanban visualizer for any Git repository</p>

<p align="center">
<code>npm i -g backlog.md</code> or <code>bun add -g backlog.md</code> or <code>brew install backlog-md</code> or <code>nix run github:MrLesk/Backlog.md</code>
</p>

![Backlog demo GIF using: backlog board](./.github/backlog.gif)


---

> **Backlog.md** turns any folder with a Git repo into a **self‑contained project board**  
> powered by plain Markdown files and a zero‑config CLI.

## Features

* 📝 **Markdown-native tasks** -- manage every issue as a plain `.md` file

* 🤖 **AI-Ready** -- Works with Claude Code, Gemini CLI, Codex & any other MCP or CLI compatible AI assistants

* 📊 **Instant terminal Kanban** -- `backlog board` paints a live board in your shell

* 🌐 **Modern web interface** -- `backlog browser` launches a sleek web UI for visual task management

* 🔍 **Powerful search** -- fuzzy search across tasks, docs & decisions with `backlog search`

* 📋 **Rich query commands** -- view, list, filter, or archive tasks with ease

* 📤 **Board export** -- `backlog board export` creates shareable markdown reports

* 🔒 **100 % private & offline** -- backlog lives entirely inside your repo and you can manage everything locally

* 💻 **Cross-platform** -- runs on macOS, Linux, and Windows

* 🆓 **MIT-licensed & open-source** -- free for personal or commercial use


---

## <img src="./.github/5-minute-tour-256.png" alt="5-minute tour" width="28" height="28" align="center"> Five‑minute tour
```bash
# 1. Make sure you have Backlog.md installed (global installation recommended) 
bun i -g backlog.md 
or 
npm i -g backlog.md 
or 
brew install backlog-md

# 2. Bootstrap a repo + backlog and choose the AI Agent integration mode (MCP, CLI, or skip)
backlog init "My Awesome Project"

# 3. Create tasks manually  
backlog task create "Render markdown as kanban"

# 4. Or ask AI to create them: Claude Code, Gemini CLI, or Codex (Agents automatically use Backlog.md via MCP or CLI)
Claude I would like to build a search functionality in the web view that searches for:
* tasks
* docs
* decisions
  Please create relevant tasks to tackle this request.

# 5. See where you stand
backlog board view or backlog browser

# 6. Assign tasks to AI (Backlog.md instructions tell agents how to work with tasks)
Claude please implement all tasks related to the web search functionality (task-10, task-11, task-12)
* before starting to write code use 'ultrathink mode' to prepare and add an implementation plan to the task
* use multiple sub-agents when possible and dependencies allow
```

All data is saved under `backlog` folder as human‑readable Markdown with the following format `task-<task-id> - <task-title>.md` (e.g. `task-10 - Add core search functionality.md`).

---

## <img src="./.github/web-interface-256.png" alt="Web Interface" width="28" height="28" align="center"> Web Interface

Launch a modern, responsive web interface for visual task management:

```bash
# Start the web server (opens browser automatically)
backlog browser

# Custom port
backlog browser --port 8080

# Don't open browser automatically
backlog browser --no-open
```

**Features:**
- Interactive Kanban board with drag-and-drop
- Task creation and editing with rich forms
- Interactive acceptance criteria editor with checklists
- Real-time updates across all views
- Responsive design for desktop and mobile
- Task archiving with confirmation dialogs
- Seamless CLI integration - all changes sync with markdown files

![Web Interface Screenshot](./.github/web.jpeg)

---

## 🔧 MCP Integration (Model Context Protocol)

The easiest way to connect Backlog.md to AI coding assistants like Claude Code, Codex, and Gemini CLI is via the MCP protocol.
You can run `backlog init` (even if you already initialized Backlog.md) to set up MCP integration automatically, or follow the manual steps below.

### Client guides

> [!IMPORTANT]
> When adding the MCP server manually, you should add some extra instructions in your CLAUDE.md/AGENTS.md files to inform the agent about Backlog.md. 
> This step is not required when using `backlog init` as it adds these instructions automatically.
> Backlog.md's instructions for agents are available at [`/src/guidelines/mcp/agent-nudge.md`](/src/guidelines/mcp/agent-nudge.md).

<details>
  <summary><strong>Claude Code</strong></summary>

  ```bash
  claude mcp add backlog --scope user -- backlog mcp start
  ```

</details>

<details>
  <summary><strong>Codex</strong></summary>

  ```bash
  codex mcp add backlog backlog mcp start
  ```

</details>

<details>
  <summary><strong>Gemini CLI</strong></summary>

  ```bash
  gemini mcp add backlog -s user backlog mcp start
  ```

</details>

Use the shared `backlog` server name everywhere – the MCP server auto-detects whether the current directory is initialized and falls back to `backlog://init-required` when needed.

### Manual config

```json
{
  "mcpServers": {
    "backlog": {
      "command": "backlog",
      "args": ["mcp", "start"]
    }
  }
}
```

Once connected, agents can read the Backlog.md workflow instructions via the resource `backlog://docs/task-workflow`.
Use `/mcp` command in your AI tool (Claude Code, Codex) to verify if the connection is working.

---

## <img src="./.github/cli-reference-256.png" alt="CLI Reference" width="28" height="28" align="center"> CLI reference

### Project Setup

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Initialize project | `backlog init [project-name]` (creates backlog structure with a minimal interactive flow) |
| Re-initialize | `backlog init` (preserves existing config, allows updates) |
| Advanced settings wizard | `backlog config` (no args) — launches the full interactive configuration flow |

`backlog init` keeps first-run setup focused on the essentials:
- **Project name** – identifier for your backlog (defaults to the current directory on re-run).
- **Integration choice** – decide whether your AI tools connect through the **MCP connector** (recommended) or stick with **CLI commands (legacy)**.
- **Instruction files (CLI path only)** – when you choose the legacy CLI flow, pick which instruction files to create (CLAUDE.md, AGENTS.md, GEMINI.md, Copilot, or skip).
- **Advanced settings prompt** – default answer “No” finishes init immediately; choosing “Yes” jumps straight into the advanced wizard documented in [Configuration](#configuration).

You can rerun the wizard anytime with `backlog config`. All existing CLI flags (for example `--defaults`, `--agent-instructions`, or `--install-claude-agent true`) continue to provide fully non-interactive setups, so existing scripts keep working without change.

### Documentation

- Document IDs are global across all subdirectories under `backlog/docs`. You can organize files in nested folders (e.g., `backlog/docs/guides/`), and `backlog doc list` and `backlog doc view <id>` work across the entire tree. Example: `backlog doc create -p guides "New Guide"`.

### Task Management

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
| Create with notes | `backlog task create "Feature" --notes "Started initial research"` |
| Create with deps | `backlog task create "Feature" --dep task-1,task-2` |
| Create sub task | `backlog task create -p 14 "Add Login with Google"`|
| Create (all options) | `backlog task create "Feature" -d "Description" -a @sara -s "To Do" -l auth --priority high --ac "Must work" --notes "Initial setup done" --dep task-1 -p 14` |
| List tasks  | `backlog task list [-s <status>] [-a <assignee>] [-p <parent>]` |
| List by parent | `backlog task list --parent 42` or `backlog task list -p task-42` |
| View detail | `backlog task 7` (interactive UI, press 'E' to edit in editor) |
| View (AI mode) | `backlog task 7 --plain`                           |
| Edit        | `backlog task edit 7 -a @sara -l auth,backend`       |
| Add plan    | `backlog task edit 7 --plan "Implementation approach"`    |
| Add AC      | `backlog task edit 7 --ac "New criterion" --ac "Another one"` |
| Remove AC   | `backlog task edit 7 --remove-ac 2` (removes AC #2)      |
| Remove multiple ACs | `backlog task edit 7 --remove-ac 2 --remove-ac 4` (removes AC #2 and #4) |
| Check AC    | `backlog task edit 7 --check-ac 1` (marks AC #1 as done) |
| Check multiple ACs | `backlog task edit 7 --check-ac 1 --check-ac 3` (marks AC #1 and #3 as done) |
| Uncheck AC  | `backlog task edit 7 --uncheck-ac 3` (marks AC #3 as not done) |
| Mixed AC operations | `backlog task edit 7 --check-ac 1 --uncheck-ac 2 --remove-ac 4` |
| Add notes   | `backlog task edit 7 --notes "Completed X, working on Y"` (replaces existing) |
| Append notes | `backlog task edit 7 --append-notes "New findings"` |
| Add deps    | `backlog task edit 7 --dep task-1 --dep task-2`     |
| Archive     | `backlog task archive 7`                             |

#### Multi‑line input (description/plan/notes)

The CLI preserves input literally; `\n` sequences are not auto‑converted. Use one of the following to insert real newlines:

- **Bash/Zsh (ANSI‑C quoting)**
  - Description: `backlog task create "Feature" --desc $'Line1\nLine2\n\nFinal paragraph'`
  - Plan: `backlog task edit 7 --plan $'1. Research\n2. Implement'`
  - Notes: `backlog task edit 7 --notes $'Completed A\nWorking on B'`
  - Append notes: `backlog task edit 7 --append-notes $'Added X\nAdded Y'`
- **POSIX sh (printf)**
  - `backlog task create "Feature" --desc "$(printf 'Line1\nLine2\n\nFinal paragraph')"`
- **PowerShell (backtick)**
  - `backlog task create "Feature" --desc "Line1`nLine2`n`nFinal paragraph"`

Tip: Help text shows Bash examples with escaped `\\n` for readability; when typing, `$'\n'` expands to a newline.

### Search

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

### Draft Workflow

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create draft | `backlog task create "Feature" --draft`             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

### Dependency Management

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

### Board Operations

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Kanban board      | `backlog board` (interactive UI, press 'E' to edit in editor) |
| Export board | `backlog board export [file]` (exports Kanban board to markdown) |
| Export with version | `backlog board export --export-version "v1.0.0"` (includes version in export) |

### Statistics & Overview

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Project overview | `backlog overview` (interactive TUI showing project statistics) |

### Web Interface

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Web interface | `backlog browser` (launches web UI on port 6420) |
| Web custom port | `backlog browser --port 8080 --no-open` |

### Documentation

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create doc | `backlog doc create "API Guidelines"` |
| Create with path | `backlog doc create "Setup Guide" -p guides/setup` |
| Create with type | `backlog doc create "Architecture" -t technical` |
| List docs | `backlog doc list` |
| View doc | `backlog doc view doc-1` |

### Decisions

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create decision | `backlog decision create "Use PostgreSQL for primary database"` |
| Create with status | `backlog decision create "Migrate to TypeScript" -s proposed` |

### Agent Instructions

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Update agent files | `backlog agents --update-instructions` (updates CLAUDE.md, AGENTS.md, GEMINI.md, .github/copilot-instructions.md) |

### Maintenance

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Cleanup done tasks | `backlog cleanup` (move old completed tasks to completed folder) |

Full help: `backlog --help`

---

## <img src="./.github/configuration-256.png" alt="Configuration" width="28" height="28" align="center"> Configuration

Backlog.md merges the following layers (highest → lowest):

1. CLI flags
2. `backlog/config.yml` (per‑project)
3. `~/backlog/user` (per‑user)
4. Built‑ins

### Configuration Commands

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| View all configs | `backlog config list` |
| Get specific config | `backlog config get defaultEditor` |
| Set config value | `backlog config set defaultEditor "code --wait"` |
| Enable auto-commit | `backlog config set autoCommit true` |
| Bypass git hooks | `backlog config set bypassGitHooks true` |
| Enable cross-branch check | `backlog config set checkActiveBranches true` |
| Set active branch days | `backlog config set activeBranchDays 30` |

### Interactive wizard (`backlog config`)

Run `backlog config` with no arguments to launch the full interactive wizard. This is the same experience triggered from `backlog init` when you opt into advanced settings, and it walks through the complete configuration surface:
- Cross-branch accuracy: `checkActiveBranches`, `remoteOperations`, and `activeBranchDays`.
- Git workflow: `autoCommit` and `bypassGitHooks`.
- ID formatting: enable or size `zeroPaddedIds`.
- Editor integration: pick a `defaultEditor` with availability checks.
- Web UI defaults: choose `defaultPort` and whether `autoOpenBrowser` should run.

Skipping the wizard (answering “No” during init) applies the safe defaults that ship with Backlog.md:
- `checkActiveBranches=true`, `remoteOperations=true`, `activeBranchDays=30`.
- `autoCommit=false`, `bypassGitHooks=false`.
- `zeroPaddedIds` disabled.
- `defaultEditor` unset (falls back to your environment).
- `defaultPort=6420`, `autoOpenBrowser=true`.

Whenever you revisit `backlog init` or rerun `backlog config`, the wizard pre-populates prompts with your current values so you can adjust only what changed.

### Available Configuration Options

| Key               | Purpose            | Default                       |
|-------------------|--------------------|-------------------------------|
| `defaultAssignee` | Pre‑fill assignee  | `[]`                          |
| `defaultStatus`   | First column       | `To Do`                       |
| `statuses`        | Board columns      | `[To Do, In Progress, Done]`  |
| `dateFormat`      | Date/time format   | `yyyy-mm-dd hh:mm`            |
| `timezonePreference` | Timezone for dates | `UTC`                     |
| `includeDatetimeInDates` | Add time to new dates | `true`              |
| `defaultEditor`   | Editor for 'E' key | Platform default (nano/notepad) |
| `defaultPort`     | Web UI port        | `6420`                        |
| `autoOpenBrowser` | Open browser automatically | `true`            |
| `remoteOperations`| Enable remote git operations | `true`           |
| `autoCommit`      | Automatically commit task changes | `false`       |
| `bypassGitHooks`  | Skip git hooks when committing (uses --no-verify) | `false`       |
| `zeroPaddedIds`   | Pad all IDs (tasks, docs, etc.) with leading zeros | `(disabled)`  |
| `checkActiveBranches` | Check task states across active branches for accuracy | `true` |
| `activeBranchDays` | How many days a branch is considered active | `30` |
| `onStatusChange`  | Shell command to run on status change | `(disabled)` |

> Editor setup guide: See [Configuring VIM and Neovim as Default Editor](backlog/docs/doc-002%20-%20Configuring-VIM-and-Neovim-as-Default-Editor.md) for configuration tips and troubleshooting interactive editors.

> **Note**: Set `remoteOperations: false` to work offline. This disables git fetch operations and loads tasks from local branches only, useful when working without network connectivity.

> **Git Control**: By default, `autoCommit` is set to `false`, giving you full control over your git history. Task operations will modify files but won't automatically commit changes. Set `autoCommit: true` if you prefer automatic commits for each task operation.

> **Git Hooks**: If you have pre-commit hooks (like conventional commits or linters) that interfere with backlog.md's automated commits, set `bypassGitHooks: true` to skip them using the `--no-verify` flag.

> **Performance**: Cross-branch checking ensures accurate task tracking across all active branches but may impact performance on large repositories. You can disable it by setting `checkActiveBranches: false` for maximum speed, or adjust `activeBranchDays` to control how far back to look for branch activity (lower values = better performance).

> **Status Change Callbacks**: Set `onStatusChange` to run a shell command whenever a task's status changes. Available variables: `$TASK_ID`, `$OLD_STATUS`, `$NEW_STATUS`, `$TASK_TITLE`. Per-task override via `onStatusChange` in task frontmatter. Example: `'if [ "$NEW_STATUS" = "In Progress" ]; then claude "Task $TASK_ID ($TASK_TITLE) has been assigned to you. Please implement it." & fi'`

> **Date/Time Support**: Backlog.md now supports datetime precision for all dates. New items automatically include time (YYYY-MM-DD HH:mm format in UTC), while existing date-only entries remain unchanged for backward compatibility. Use the migration script `bun src/scripts/migrate-dates.ts` to optionally add time to existing items.

---

## 💡 Shell Tab Completion

Backlog.md includes built-in intelligent tab completion for bash, zsh, and fish shells. Completion scripts are embedded in the binary—no external files needed.

**Quick Installation:**
```bash
# Auto-detect and install for your current shell
backlog completion install

# Or specify shell explicitly
backlog completion install --shell bash
backlog completion install --shell zsh
backlog completion install --shell fish
```

**What you get:**
- Command completion: `backlog <TAB>` → shows all commands
- Dynamic task IDs: `backlog task edit <TAB>` → shows actual task IDs from your backlog
- Smart flags: `--status <TAB>` → shows configured status values
- Context-aware suggestions for priorities, labels, and assignees

📖 **Full documentation**: See [completions/README.md](completions/README.md) for detailed installation instructions, troubleshooting, and examples.

---

## <img src="./.github/sharing-export-256.png" alt="Sharing & Export" width="28" height="28" align="center"> Sharing & Export

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

<!-- BOARD_START -->

## 📊 Backlog.md Project Status (v1.26.2)

This board was automatically generated by [Backlog.md](https://backlog.md)

Generated on: 2025-12-04 20:31:00

| To Do | In Progress | Done |
| --- | --- | --- |
| **TASK-310** - Strengthen Backlog workflow overview emphasis on reading detailed guides [@codex] | └─ **TASK-24.1** - CLI: Kanban board milestone view [@codex] | **TASK-334** - Fix task numbering reset when all tasks archived [@codex]<br>*#bug #id-generation* |
| **TASK-270** - Prevent command substitution in task creation inputs [@codex] |  | **TASK-309** - Improve TUI empty state when task filters return no results [@codex] |
| **TASK-268** - Show agent instruction version status [@codex] |  | **TASK-333** - Keep cross-branch tasks out of plain CLI/MCP listings [@codex]<br>*#cli #mcp #bug* |
| **TASK-267** - Add agent instruction version metadata [@codex] |  | **TASK-332** - Unify CLI task list/board loading and view switching UX [@codex]<br>*#cli #ux #loading* |
| **TASK-260** - Web UI: Add filtering to All Tasks view [@codex]<br>*#web-ui #filters #ui* |  | **TASK-331** - Fix content store refresh dropping cross-branch tasks [@codex]<br>*#bug #content-store* |
| **TASK-259** - Add task list filters for Status and Priority<br>*#tui #filters #ui* |  | **TASK-330** - Fix browser/CLI sync issue when reordering cross-branch tasks<br>*#bug #browser* |
| **TASK-257** - Deep link URLs for tasks in board and list views |  | **TASK-328** - Make filename sanitization stricter by default [@codex]<br>*#feature* |
| **TASK-200** - Add Claude Code integration with workflow commands during init<br>*#enhancement #developer-experience* |  | **TASK-327** - Fix loadTaskById to search remote branches<br>*#bug #task-loading #cross-branch* |
| **TASK-218** - Update documentation and tests for sequences<br>*#sequences #documentation #testing* |  | **TASK-326** - Add local branch task discovery to board loading<br>*#bug #task-loading #cross-branch* |
| **TASK-217** - Create web UI for sequences with drag-and-drop<br>*#sequences #web-ui #frontend* |  | **TASK-324** - Add browser UI initialization flow for uninitialized projects<br>*#enhancement #browser #ux* |
| └─ **TASK-217.03** - Sequences web UI: move tasks and update dependencies<br>*#sequences* |  | **TASK-289** - Implement resource templates list handler to return empty list instead of error [@codex]<br>*#mcp #enhancement* |
| └─ **TASK-217.04** - Sequences web UI: tests<br>*#sequences* |  | **TASK-280** - Fix TUI task list selection and detail pane synchronization bug [@codex]<br>*#bug #tui* |
| └─ **TASK-217.02** - Sequences web UI: list sequences<br>*#sequences* |  | **TASK-273** - Refactor search [@codex]<br>*#core #search* |
| **TASK-240** - Improve binary resolution on Apple Silicon (Rosetta/arch mismatch) [@codex]<br>*#packaging #bug #macos* |  | **TASK-322** - Fix flake.nix for devenv compatibility<br>*#nix #bug-fix* |
| **TASK-239** - Feature: Auto-link tasks to documents/decisions + backlinks [@codex]<br>*#web #enhancement #docs* |  | **TASK-321** - Status change callbacks in task frontmatter [@codex] |
| **TASK-222** - Improve task and subtask visualization in web UI |  | **TASK-320** - Refactor and fix move mode implementation [@claude]<br>*#bug #tui #high-priority* |
| **TASK-208** - Add paste-as-markdown support in Web UI<br>*#web-ui #enhancement #markdown* |  | **TASK-318** - Fix editor stdio inheritance for interactive editors (vim/neovim) [@samvincent]<br>*#bug #editor #vim* |

<!-- BOARD_END -->

### License

Backlog.md is released under the **MIT License** – do anything, just give credit. See [LICENSE](LICENSE).
