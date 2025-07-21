# Suggest Next Task

Analyzes the backlog and suggests the highest-priority task to work on next, while also checking on in-progress tasks.

## Prompt

You are my personal project manager. I need to decide which task to work on next.

1.  First, check if there are any tasks currently in progress by running: `backlog task list -s "In Progress" --plain`.
2.  For each in-progress task:
    - Note the task ID and title
    - Check if it has a branch assigned (look for branch information in the task details)
    - If no branch is assigned, suggest creating one using: `git checkout -b feature/task-<id>-<brief-description>`
3.  Next, get a prioritized list of all tasks that are in the "To Do" status by running: `backlog task list -s "To Do" --sort priority --plain`.
4.  Analyze the output. For the highest-priority task, check if it has any dependencies listed. If it does, verify that all of its dependencies have a status of "Done".
5.  Based on your analysis:
    - If there are in-progress tasks without branches, highlight this first
    - Recommend whether to continue with in-progress tasks or start a new one
    - If suggesting a new task, explain why it's the most important one to start now