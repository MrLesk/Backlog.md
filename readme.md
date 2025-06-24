<h1 align="center">Backlog.md</h1>
<p align="center">Markdown‑native Task Manager &amp; Kanban visualizer for any Git repository</p>

<p align="center">
<code>npm i -g backlog.md</code> or <code>bun add -g backlog.md</code>
</p>

![Backlog demo GIF using: backlog board](./.github/backlog.gif)


---

> **Backlog.md** turns any folder with a Git repo into a **self‑contained project board**  
> powered by plain Markdown files and a zero‑config CLI.


## Features

* 📝 **Markdown-native tasks** -- manage every issue as a plain `.md` file

* 🔒 **100 % private & offline** -- backlog lives entirely inside your repo
* 📊 **Instant terminal Kanban** -- `backlog board` paints a live board in your shell

* 🤖 **AI-ready CLI** -- "Claude, please take over task 33"

* 🔍 **Rich query commands** -- view, list, filter, or archive tasks with ease

* 💻 **Cross-platform** -- runs on macOS, Linux, and Windows

* 🆓 **MIT-licensed & open-source** -- free for personal or commercial use

---

### Five‑minute tour

```bash
# 1. Bootstrap a repo + backlog
backlog init hello-world

# 2. Capture work
backlog task create "Render markdown as kanban"

# 3. See where you stand
backlog board view
```

All data is saved under `.backlog` folder as human‑readable Markdown with the following format `task-<task-id> - <task-title>.md` (e.g. `task-12 - Fix typo.md`).

---

## CLI reference (essentials)

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create task | `backlog task create "Add OAuth System" [-l <label1>,<label2>]`                    |
| Create with plan | `backlog task create "Feature" --plan "1. Research\n2. Implement"`     |
| Create with AC | `backlog task create "Feature" --ac "Must work,Must be tested"` |
| Create with deps | `backlog task create "Feature" --dep task-1,task-2` |
| Create sub task | `backlog task create -p 14 "Add Login with Google"`|
| List tasks  | `backlog task list [-s <status>] [-a <assignee>]`     |
| View detail | `backlog task 7`                                     |
| View (AI mode) | `backlog task 7 --plain`                           |
| Edit        | `backlog task edit 7 -a @sara -l auth,backend`       |
| Add plan    | `backlog task edit 7 --plan "Implementation approach"`    |
| Add AC      | `backlog task edit 7 --ac "New criterion,Another one"`    |
| Add deps    | `backlog task edit 7 --dep task-1 --dep task-2`     |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |
| Kanban board      | `backlog board`            |

Full help: `backlog --help`

---

## Web Interface

Backlog.md includes a built-in web server that provides a modern React-based interface for managing your tasks visually through a drag-and-drop Kanban board.

### Getting Started

```bash
# Start the web server (opens browser automatically)
backlog serve

# Customize port and options
backlog serve --port 8080 --host 0.0.0.0 --no-open
```

### Features

* 🎯 **Interactive Kanban Board** -- Drag and drop tasks between columns
* 📋 **Task Management** -- Create, edit, and view tasks with rich forms
* 🔍 **Smart Filtering** -- Filter tasks by status, assignee, or labels
* 📱 **Responsive Design** -- Works on desktop, tablet, and mobile
* 🚀 **Single Executable** -- Complete web UI embedded in CLI binary
* 🔄 **Real-time Updates** -- Changes sync with your local `.backlog/` files

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port <port>` | Port to serve on | `3000` |
| `--host <host>` | Host to bind to | `localhost` |
| `--no-open` | Don't open browser automatically | Opens browser |

### Web Interface Views

**📊 Kanban Board**
- Visual task management with drag-and-drop between status columns
- Priority indicators and task metadata at a glance
- Responsive layout adapts to screen size

**📝 Task List**
- Sortable table view with filtering capabilities
- Click any task to view details in modal
- Bulk operations and advanced filtering

**✏️ Task Details & Forms**
- Rich task editing with markdown support
- Acceptance criteria and implementation plan sections
- Label management and dependency tracking

### Browser Support

The web interface works in all modern browsers including Chrome, Firefox, Safari, and Edge.

### Troubleshooting

**Port already in use**: The server automatically tries the next available port (3001, 3002, etc.)

**Browser doesn't open**: Use the URL shown in the terminal or manually navigate to `http://localhost:3000`

**Web UI not loading**: Ensure you've built the project with `bun run build` to embed the web assets

---

## Configuration

Backlog.md merges the following layers (highest → lowest):

1. CLI flags  
2. `.backlog/config.yml` (per‑project)  
3. `~/.backlog/user` (per‑user)  
4. Built‑ins  

Key options:

| Key               | Purpose            | Default                       |
|-------------------|--------------------|-------------------------------|
| `default_assignee`| Pre‑fill assignee  | `[]`                          |
| `default_status`  | First column       | `To Do`                       |
| `statuses`        | Board columns      | `[To Do, In Progress, Done]`  |
| `date_format`     | ISO or locale      | `yyyy-mm-dd`                  |

---


## License

Backlog.md is released under the **MIT License** – do anything, just give credit. See [LICENSE](LICENSE).
