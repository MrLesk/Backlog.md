# Tasks

List of tasks that are ready to be implemented

Tasks are stored as `task-<id> - <title>.md`.  
For subtasks, use decimal numbering like `task-4.1 - example.md`.

Example of a task definition in Markdown format:

```markdown
---
id: task-1
title: "Bootstrap Backlog.md Project Definition with Initial Tasks"
status: "Done"
assignee: "@MrLesk"
reporter: "@MrLesk"
created_date: 2025-06-03
completed_date: 2025-06-03
labels: ["project-setup", "meta", "milestone-0"]
milestone: "M0 - Project Setup"
---

## Description

Define the initial Backlog working directory structure and create the first set of tasks for building the Backlog tool itself using the Backlog methodology. This includes defining the first three milestones (CLI, Kanban Dashboard, GUI) and their high-level tasks. Set up Git for version control and define basic rules for AI agents.

## Acceptance Criteria (Optional)

- [x] `.backlog` directory structure created.
- [x] Initial `config.yml` created.
- [x] Markdown task files for Milestones 1, 2, and 3 high-level tasks created in `.backlog/tasks/` or `.backlog/draft/`.
- [x] All initial tasks committed to the Git repository.
- [x] `agents.md` file for AI Agent instructions

## Implementation Plan (Optional)

Describe the approach you plan to take to implement this task. This can include:
- Key steps or phases
- Technical decisions or architectural choices
- Dependencies or prerequisites to address
- Testing strategy

## Notes & Comments (Optional)
This task serves as the foundation for the Backlog.md project, ensuring that all subsequent tasks and milestones are built upon a solid structure. It is crucial for maintaining organization and clarity throughout the project lifecycle.
```
