# Parse PRD

Parses a PRD document into a set of structured tasks, sub-tasks, and dependencies.

## Parameters
- `doc_path`: Path to the PRD document
- `milestone_id`: Milestone ID for the tasks

## Prompt

You are a senior software engineer responsible for project planning using the `backlog.md` CLI tool. Your task is to break down a Product Requirements Document (PRD) into a comprehensive set of actionable development tasks.

1. **Read the PRD** located at: `{{.doc_path}}`.
2. **Analyze the requirements** and formulate a list of atomic tasks required for implementation. For each task, define a clear title, a concise description, and 2-4 outcome-focused acceptance criteria.
3. **Structure the work** by identifying parent-child relationships (sub-tasks) and dependencies between tasks.
4. **Execute `backlog task create` commands** to create each task. Apply the following rules:
    *   Use the `--milestone {{.milestone_id}}` flag for all tasks.
    *   Use the `-p <parent_id>` flag for sub-tasks.
    *   Use the `--dep <dependency_id>` flag for tasks that depend on others.
    *   Apply relevant labels like `backend`, `frontend`, `database`, `api` using the `-l` flag.

Start with foundational tasks (e.g., database schema) and proceed to dependent tasks (e.g., API endpoints, then UI components). After you have generated all the commands, present them to me for review before you would theoretically execute them.