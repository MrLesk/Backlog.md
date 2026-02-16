<h1 align="center">Backlog.md</h1>
<p align="center">Markdown‑native Task Manager &amp; Kanban visualizer for any Git repository</p>

<p align="center">
<code>npm i -g backlog.md</code> or <code>bun add -g backlog.md</code> or <code>brew install backlog-md</code> or <code>nix run github:MrLesk/Backlog.md</code>
</p>

![Backlog demo GIF using: backlog board](./.github/backlog.gif)


---

> **Backlog.md** turns any folder with a Git repo into a **self‑contained project board**
> powered by plain Markdown files and a zero‑config CLI.
> Built for **spec‑driven AI development** — structure your tasks so AI agents deliver predictable results.

## Features

* 📝 **Markdown-native tasks** -- manage every issue as a plain `.md` file

* 🤖 **AI-Ready** -- Works with Claude Code, Gemini CLI, Codex & any other MCP or CLI compatible AI assistants

* 📊 **Instant terminal Kanban** -- `backlog board` paints a live board in your shell

* 🌐 **Modern web interface** -- `backlog browser` launches a sleek web UI for visual task management

* 🔍 **Powerful search** -- fuzzy search across tasks, docs & decisions with `backlog search`

* 📋 **Rich query commands** -- view, list, filter, or archive tasks with ease
* ✅ **Definition of Done defaults** -- add a reusable checklist to every new task

* 📤 **Board export** -- `backlog board export` creates shareable markdown reports

* 🔒 **100 % private & offline** -- backlog lives entirely inside your repo and you can manage everything locally

* 💻 **Cross-platform** -- runs on macOS, Linux, and Windows

* 🆓 **MIT-licensed & open-source** -- free for personal or commercial use


---

## <img src="./.github/5-minute-tour-256.png" alt="Getting started" width="28" height="28" align="center"> Getting started

```bash
# Install
bun i -g backlog.md
# or: npm i -g backlog.md
# or: brew install backlog-md

# Initialize in any git repo
backlog init "My Awesome Project"
```

The init wizard will ask how you want to connect AI tools:
- **MCP connector** (recommended) — auto-configures Claude Code, Codex, Gemini CLI, or Cursor and adds workflow instructions for your agents.
- **CLI commands** — creates instruction files (CLAUDE.md, AGENTS.md, etc.) so agents use Backlog via CLI.
- **Skip** — no AI setup; use Backlog.md purely as a task manager.

All data is saved under the `backlog` folder as human-readable Markdown files (e.g. `task-10 - Add core search functionality.md`).

---

### Working with AI agents

This is the recommended flow for Claude Code, Codex, Gemini CLI, and similar tools — following the **spec‑driven AI development** approach.
After running `backlog init` and choosing the MCP or CLI integration, work in this loop:

**Step 1 — Describe your idea.** Tell the agent what you want to build and ask it to split the work into small tasks with clear descriptions and acceptance criteria.

> **🤖 Ask your AI Agent:** I want to add a search feature to the web view that searches tasks, docs, and decisions. Please decompose this into small Backlog.md tasks.

> [!NOTE]
> **Review checkpoint #1** — read the task descriptions and acceptance criteria. Make sure each task is small enough to complete in a single session.

**Step 2 — One task at a time.** Work on a single task per agent session, one PR per task. Good task splitting means each session can work independently without conflicts.

**Step 3 — Plan before coding.** Ask the agent to research and write an implementation plan in the task. Do this right before implementation so the plan reflects the current state of the codebase.

> **🤖 Ask your AI Agent:** Work on BACK-10 only. Research the codebase and write an implementation plan in the task. Wait for my approval before coding.

> [!NOTE]
> **Review checkpoint #2** — read the plan. Does the approach make sense? Approve it or ask the agent to revise.

**Step 4 — Implement and verify.** Let the agent implement the task.

> [!NOTE]
> **Review checkpoint #3** — review the code, run tests, check linting, and verify the results match your expectations.

If the output is not good enough: clear the plan/notes/final summary, refine the task description and acceptance criteria, and run the task again in a fresh session.

---

### Working without AI agents

Use Backlog.md as a standalone task manager from the terminal or browser.

```bash
# Create and refine tasks
backlog task create "Render markdown as kanban"
backlog task edit BACK-1 -d "Detailed context" --ac "Clear acceptance criteria"

# Track work
backlog task list -s "To Do"
backlog search "kanban"
backlog board

# Work visually in the browser
backlog browser
```

You can switch between AI-assisted and manual workflows at any time — both operate on the same Markdown task files. It is recommended to modify tasks via Backlog.md commands (CLI/MCP/Web) rather than editing task files manually, so field types and metadata stay consistent.

**Learn more:** [CLI reference](CLI-INSTRUCTIONS.md) | [Advanced configuration](ADVANCED-CONFIG.md)

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

Full command reference — task management, search, board, docs, decisions, and more: **[CLI-INSTRUCTIONS.md](CLI-INSTRUCTIONS.md)**

Quick examples: `backlog task create`, `backlog task list`, `backlog task edit`, `backlog search`, `backlog board`, `backlog browser`.

Full help: `backlog --help`

---

## <img src="./.github/configuration-256.png" alt="Configuration" width="28" height="28" align="center"> Configuration

Backlog.md merges the following layers (highest → lowest):

1. CLI flags
2. `backlog/config.yml` (per‑project)
3. `~/backlog/user` (per‑user)
4. Built‑ins

### Interactive wizard (`backlog config`)

Run `backlog config` with no arguments to launch the full interactive wizard. This is the same experience triggered from `backlog init` when you opt into advanced settings, and it walks through the complete configuration surface:
- Cross-branch accuracy: `checkActiveBranches`, `remoteOperations`, and `activeBranchDays`.
- Git workflow: `autoCommit` and `bypassGitHooks`.
- ID formatting: enable or size `zeroPaddedIds`.
- Editor integration: pick a `defaultEditor` with availability checks.
- Web UI defaults: choose `defaultPort` and whether `autoOpenBrowser` should run.

Skipping the wizard (answering "No" during init) applies the safe defaults that ship with Backlog.md:
- `checkActiveBranches=true`, `remoteOperations=true`, `activeBranchDays=30`.
- `autoCommit=false`, `bypassGitHooks=false`.
- `zeroPaddedIds` disabled.
- `defaultEditor` unset (falls back to your environment).
- `defaultPort=6420`, `autoOpenBrowser=true`.

Whenever you revisit `backlog init` or rerun `backlog config`, the wizard pre-populates prompts with your current values so you can adjust only what changed.

### Definition of Done defaults

Set project-wide DoD items in the Web UI (Settings → Definition of Done Defaults) or edit `backlog/config.yml` directly:

```yaml
definition_of_done:
  - Tests pass
  - Documentation updated
  - No regressions introduced
```

These items are added to every new task by default. You can add more on create with `--dod`, or disable defaults per task with `--no-dod-defaults`. Array values like `definition_of_done` must be edited in the config file or via the Web UI.

For the full configuration reference (all options, commands, and detailed notes), see **[ADVANCED-CONFIG.md](ADVANCED-CONFIG.md)**.

---

### License

Backlog.md is released under the **MIT License** – do anything, just give credit. See [LICENSE](LICENSE).
