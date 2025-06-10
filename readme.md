<h1 align="center">Backlog.md</h1>
<p align="center">Lightweight git + markdown project management tool</p>

<p align="center">
  <a href="https://www.npmjs.com/package/backlog.md">
    <img src="https://badgen.net/npm/v/backlog.md?icon=npm&label=npm%20install" alt="npm version" />
  </a>
  <img src="https://badgen.net/badge/bun/add%20backlog.md/black?icon=bun" alt="bun install" />
</p>

<p align="center"><code>npm i -g backlog.md</code></p>

## Overview

Backlog.md is a tool for managing project collaboration between humans and AI Agents in a git ecosystem.

**License:** [MIT](LICENSE) · See our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get involved.

## Requirements

1. Git repository
2. Backlog.md CLI

### Local Installation

Install as a project dependency and run using `npx` or `bunx`:

```bash
npm install backlog.md --save-dev
# or
bun add -d backlog.md
```

Run the CLI from any directory within the project:

```bash
npx backlog --help
bunx backlog --help
```

### Quick Start

Install globally and create a new project:

```bash
npm i -g backlog.md
# or
bun add -g backlog.md
backlog init my-project
cd my-project
backlog task create "Hello world"
backlog task list
```

## Instructions

Initialize project folder:

```shell
backlog init <project-name>
```

If no git repository exists in the current folder, the command will ask whether
to initialize one before continuing. Choose `y` to create a new repository or
`n` to abort so you can run the command in the correct project directory.

During initialization you will also be prompted for a default **reporter** name
to use when creating tasks. You can choose to save this setting globally in your
home directory or locally in a hidden `.user` file (which is automatically
ignored by Git).

Run the command locally using Bun:

```bash
bun run src/cli.ts init <project-name>
```

This will create the required files under `.backlog` folder.  
Task files are named `task-<id> - <title>.md`.  
Subtasks use decimal numbers, e.g., `task-4.1`.

## Tasks

1. Add your first task

    ```shell
    backlog task create "<title>"
    ```

    This initialize a new task based on your input. When you are done you can find the task under `.backlog/tasks` folder

    Options:
    - `-d, --description "<text>"`: Multi-line description.
    - `-a, --assignee "<username_or_email>"`
    - `-s, --status "<status_name>"` (Defaults to the first active status, e.g., "To Do").
    - `-l, --label "<label1>,<label2>"`
    - `--draft` create the task as a draft in `.backlog/drafts`

2. Add a subtask

    ```shell
    backlog task create "<title>" --parent <task-id>
    ```

    Use `--parent` to specify the parent task. The next decimal ID is assigned automatically.

3. List:

    ```shell
    backlog task list
    # or
    backlog tasks list
    ```

4. Detail:

    ```shell
    backlog task view <task-id>
    # or
    backlog tasks view <task-id>
    # or
    backlog task <task-id>
    ```

5. Edit

    ```shell
    backlog task edit <task-id>
    ```

     Options:
    - `-t, --title "<new title>"`
    - `-d, --description "<text>"`: Multi-line description.
    - `-a, --assignee "<username_or_email>"`
    - `-s, --status "<status_name>"`
    - `-l, --label "<new-label>"` (Overrides all previous labels)
    - `--add-label <label>`
    - `--remove-label <label>`

6. Archive

    ```shell
    backlog task archive <task-id>
    backlog draft archive <task-id>
    backlog draft promote <task-id>
    backlog task demote <task-id>
```

7. Kanban board

    ```shell
    backlog board view
    backlog board view --layout vertical
    backlog board view --vertical
    backlog board view --milestones
    backlog board export --output <file>
    ```

    View the board in horizontal (default) or vertical layout. Use `--layout vertical` or the shortcut `--vertical`. Use `--milestones` to group tasks by milestone. Export the board to a file - by default it's appended to `readme.md` if it exists. Use `--output` to specify a different file.

## Drafts

In some cases we have tasks that are not ready to be started. Either because they are missing some required information or some dependencies are not ready. For these cases we can still create the tasks in "Draft mode".

To create a draft you can use:

```shell
backlog draft create "<title>"
```

To promote a draft to the tasks list:

```shell
backlog draft promote <task-id>
```

To move a task back to drafts:

```shell
backlog task demote <task-id>
```

## Documentation & Decisions

Use the following commands to manage project documentation files and decision logs:

```shell
backlog doc create "<title>" -p optional/subfolder
backlog doc list
backlog decision create "<title>"
backlog decision list
```

## Configuration

Commands for getting and setting the options for the current project

```shell
backlog config get <key>
```

```shell
backlog config set <key>
```

Add `--local` (default) to update `.backlog/config.yml` for the current
project or `--global` to update your user settings in `~/.backlog/user`.
`backlog config get <key>` checks the local config first, then the global
user config, and finally falls back to built-in defaults.

Example:

```shell
backlog config set default_assignee @aiSupervisor
```

### Configuration Options

`config.yml` supports the following keys:

- `project_name`: Name of the project
- `default_assignee`: Optional user assigned to new tasks
- `default_status`: Default status for new tasks
- `statuses`: List of allowed task statuses
- `labels`: List of available labels
- `milestones`: Project milestones
- `date_format`: Format for `created_date` values (default `yyyy-mm-dd`)

The default configuration provides the statuses `To Do`, `In Progress`, and `Done`. Draft tasks are stored separately under `.backlog/drafts`.

## Migration: Assignee Field

The `assignee` frontmatter key is now an array. New tasks are created with:

```yaml
assignee: []
```

For existing tasks using a single string, update:

```yaml
assignee: "@user"
```

to:

```yaml
assignee:
  - "@user"
```

See `.backlog/docs/assignee-field-migration.md` for more details.

For local development instructions, see [DEVELOPMENT.md](DEVELOPMENT.md).

