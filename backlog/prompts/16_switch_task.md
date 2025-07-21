# Switch Task

Switch between different in-progress tasks by stashing current work and switching branches.

## Parameters
- `task_ref`: The task reference to switch to (e.g., "task-0004", "0004", or just "4")

## Prompt

You are my development assistant. I need to switch from my current task to work on {{.task_ref}}.

1. Check current status:
   ```
   # Current branch
   git branch --show-current
   
   # Uncommitted changes
   git status --porcelain
   ```

2. Identify current task from branch name:
   - Extract task ID from current branch (if it follows task-XXXX pattern)
   - If found, show current task details briefly

3. Stash current work if needed:
   ```
   # If there are uncommitted changes
   git stash push -m "WIP: task-{{.current_task_id}} - {{.timestamp}}"
   ```

4. Read target task details:
   ```
   backlog task {{.normalized_task_ref}} --plain
   ```

5. Find or create the branch for target task:
   - List all branches: `git branch -a | grep -i "task-{{.task_id}}"`
   - If branch exists:
     ```
     git checkout task-{{.task_id}}-{{.description}}
     git pull origin task-{{.task_id}}-{{.description}}
     ```
   - If no branch exists:
     - Ask if I want to create a new branch
     - If yes, run the start-task workflow

6. Check for stashed work on this branch:
   ```
   git stash list | grep "task-{{.task_id}}"
   ```
   - If found, ask if I want to apply the stash

7. Update task status if needed:
   - If task is not "In Progress", update it:
     ```
     backlog task edit {{.task_id}} -s "In Progress"
     ```

8. Provide context summary:
   - Previous task: ID and what was stashed
   - Current task: ID, title, and acceptance criteria
   - Current branch name
   - Implementation plan or next steps
   - Any unstashed work available