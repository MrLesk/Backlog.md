# Branch Status

Shows the relationship between active git branches and Backlog.md tasks, helping track which tasks are being worked on in which branches.

## Prompt

You are my development assistant. I want to see which tasks are currently being worked on and their associated git branches.

1. First, get all tasks that are "In Progress":
   ```
   backlog task list -s "In Progress" --plain
   ```

2. Get current git branch and all local branches:
   ```
   git branch -v
   ```

3. Get all remote branches:
   ```
   git branch -r
   ```

4. Match branches to tasks:
   - Look for branch names containing task IDs (e.g., "task-42", "task-0004")
   - Check commit messages for task references
   - For each branch, run: `git log --oneline -5 <branch>` to see recent commits

5. Create a status table showing:
   - Task ID and Title
   - Assigned Developer
   - Associated Branch (if found)
   - Last Commit Date
   - Branch Status (active/stale/no branch)

6. Identify issues:
   - In-progress tasks without branches
   - Branches without corresponding in-progress tasks
   - Stale branches (no commits in 7+ days)

7. Provide recommendations:
   - Which branches might need to be cleaned up
   - Which tasks need branches created
   - Any potential conflicts or issues

Format the output as a clear table with action items at the end.