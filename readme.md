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

## Development

Run these commands to bootstrap the project:

```bash
bun install
```

Run tests:

```bash
bun test
```

Format and lint:

```bash
npx biome check .
```

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on opening issues
and submitting pull requests.

## Release

To publish a new version to npm:

1. Update the `version` field in `package.json`.
2. Commit the change and create a git tag matching the version, e.g. `v0.1.0`.
   ```bash
   git tag v<version>
   git push origin v<version>
   ```
3. Push the tag to trigger the GitHub Actions workflow. It will build, test and
   publish the package to npm using the repository `NODE_AUTH_TOKEN` secret.
## GitHub Issue and Pull Request Templates

This repository includes templates under `.github/` for bug reports, feature requests, and pull requests.
When opening a pull request, reference the Backlog task IDs being addressed.

## Project Board

| To Do | Done |
| --- | --- |
| task-4: CLI: Task Management Commands | task-1: CLI: Setup Core Project (Bun, TypeScript, Git, Linters) |
| task-8: GUI: Setup GUI Project Structure | task-2: CLI: Design & Implement Core Logic Library |
| task-9: GUI: Implement GUI Task Creation/Editing Forms | task-3: CLI: Implement `backlog init` Command |
| task-10: GUI: Implement `backlog init` in GUI & GUI Packaging | task-4.1: CLI: Task Creation Commands |
| task-11: GUI: Implement GUI Kanban Board Display & Interaction | task-4.2: CLI: Task Listing and Viewing |
| task-12: GUI: Implement GUI for Drafts, Docs, Decisions | task-4.3: CLI: Task Editing |
| task-13.1: CLI: Agent Instruction File Selection | task-4.4: CLI: Task Archiving and State Transitions |
| task-14: GUI: introduction screens | task-4.5: CLI: Init prompts for reporter name and global/local config |
| task-15: Improve tasks readme with generic example and CLI command reference | task-4.6: CLI: Add empty assignee array field for new tasks |
| task-16: Improve docs readme with generic example and CLI command reference | task-4.7: CLI: Parse unquoted created_date |
| task-17: Improve drafts readme with generic example and CLI command reference | task-4.8: CLI: enforce description header |
| task-18: Improve decisions readme with generic example and CLI command reference | task-4.9: CLI: Normalize task-id inputs |
| task-24.1: CLI: Kanban board milestone view | task-4.10: CLI: enforce Agents to use backlog CLI to mark tasks Done |
| task-26: Agents: add board export step to agent DoD | task-4.11: Docs: add definition of done to agent guidelines |
| task-28: Add CODE OF CONDUCT | task-4.12: CLI: Handle task ID conflicts across branches |
| task-30: Create CHANGELOG | task-4.13: CLI: Fix config command local/global logic |
|  | task-5: CLI: Implement Docs & Decisions CLI Commands (Basic) |
|  | task-6: CLI: Argument Parsing, Help, and Packaging |
|  |   |— task-6.1:       CLI: Local installation support for bunx/npx |
|  |   |— task-6.2:       CLI: GitHub Actions for Build & Publish |
|  | task-7: Kanban Board: Implement CLI Text-Based Kanban Board View |
|  |   |— task-7.1:       CLI: Kanban board detect remote task status |
|  | task-13: CLI: Add Agent Instruction Prompt |
|  | task-19: CLI - fix default task status and remove Draft from statuses |
|  | task-20: Add agent guideline to mark tasks In Progress on start |
|  | task-21: Kanban board vertical layout |
|  | task-22: CLI: Prevent double dash in task filenames |
|  | task-23: CLI: Kanban board order tasks by ID ASC |
|  | task-24: Handle subtasks in the Kanban view |
|  | task-25: CLI: Export Kanban board to README |
|  | task-27: Add CONTRIBUTING guidelines |
|  | task-29: Add GitHub templates |
|  | task-31: Update README for open source |
|  | task-32: CLI: Hide empty 'No Status' column |
