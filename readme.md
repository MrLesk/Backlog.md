<h1 align="center">Backlog.md</h1>
<p align="center">Lightweight git + markdown project management tool</p>

<p align="center"><code>npm i -g @backlog.md</code></p>

## Overview

Backlog.md is a tool for managing project collaboration between humans and AI Agents in a git ecosystem.

## Requirements

1. Git repository
2. Backlog.md CLI

## Instructions

Initialize project folder:

```shell
backlog init <project-name>
```

If no git repository exists in the current folder, the command will ask whether
to initialize one before continuing. Choose `y` to create a new repository or
`n` to abort so you can run the command in the correct project directory.

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

## Configuration

Commands for getting and setting the options for the current project

```shell
backlog config get <key>
```

```shell
backlog config set <key>
```

Example:

```shell
backlog config set default_assignee @aiSupervisor
```

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
