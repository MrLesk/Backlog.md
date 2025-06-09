# Project structure

backlog.md/ (Root folder for "Backlog.md" project)
└── .backlog/ ("Backlog.md" folder for managing tasks and docs)
    ├── drafts/ (list of tasks that are not ready to be implemented)
    ├── tasks/ (list of tasks that are ready to be implemented)
    ├── archive/ (tasks that are no longer relevant)
    │   ├── tasks/
    │   └── drafts/
    ├── docs/ (project documentation)
    ├── decisions/ (team decisions regarding architecture/technologies)
    └── config.yml ("Backlog.md" configuration file)

Instructions for using the Backlog.md tool are available in the `readme.md` file in the root folder.

Each folder contains a `readme.md` file with instructions on how to use the Backlog.md tool for that specific folder.

## AI Agent Guidelines

- Use the markdown task files under `.backlog/tasks/` to decide what to implement.
- Reference the task `id` in commit messages and PR titles when closing a task.
- Subtasks use decimal numbering (e.g., `task-4.1`). Reference these IDs the same way.
- Each task must include a `## Description` section followed by a `## Acceptance Criteria` checklist.
- Include relevant tests when implementing new functionality or fixing bugs.
- Keep all project documentation in Markdown format and update the related `readme.md` files when necessary.
- Ensure the working tree is clean (`git status`) before committing changes.
- The branch name should reflect the task being worked on, e.g., `<task-id> feature description`.

## Definition of Done

- All acceptance criteria for the task are satisfied.
- Required tests are implemented and pass.
- Documentation and related `readme.md` files are updated.
- Add "## Implementation Notes" section to the task with key technical details, architectural decisions, and important changes made during implementation.
- The task is marked as done using the Backlog CLI.
