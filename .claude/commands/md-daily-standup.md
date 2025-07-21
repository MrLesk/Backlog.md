# Daily Standup

Generates a progress report for the last 24 hours and lists current in-progress tasks.

## Prompt

Generate a progress report for today. List all tasks that were moved to "Done" in the last 24 hours by looking at the git log for commits related to task status changes. Then, list all tasks currently "In Progress" by running `backlog task list -s "In Progress" --plain`.