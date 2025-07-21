# Start Task

Universal workflow for starting a task that adapts to your project's git workflow.

## Parameters
- `task_ref`: The task reference (e.g., "task-0004", "0004", or just "4")

## Prompt

You are my development assistant. I want to start working on {{.task_ref}} following our project's git workflow.

1. Normalize the task reference:
   - Convert "4" or "0004" to "task-0004"
   - Keep "task-0004.03" as-is for subtasks

2. Read the task details:
   ```
   backlog task {{.normalized_task_ref}} --plain
   ```

3. Check prerequisites:
   - Verify task status is "To Do" (or ask to continue if "In Progress")
   - Check all dependencies are "Done"
   - Ensure working directory is clean: `git status --porcelain`

4. Determine branching strategy:
   - Detect your project's main development branch (main, master, dev, develop)
   - **For simple features**: Branch from main development branch
   - **For complex milestones**: Check if milestone branch exists
   - Look for milestone labels in task to determine strategy
   - Check for existing related branches: `git branch -a | grep -E "(milestone/|task-.*{{.task_id}})"

5. Start from the correct base branch:
   ```bash
   # Detect and switch to main development branch
   DEV_BRANCH=$(git branch -a | grep -E "(dev|develop|main|master)" | grep origin | head -1 | sed 's/.*origin\///')
   git checkout $DEV_BRANCH
   git pull origin $DEV_BRANCH
   
   # If this is part of a milestone, check for milestone branch:
   git branch -a | grep "milestone/"
   ```

6. Create appropriate feature branch:
   - Extract brief, kebab-case description from task title
   - **Simple feature**: `task-{{.task_id}}-{{.brief_description}}` from main development branch
   - **Milestone task**: `task-{{.task_id}}-{{.brief_description}}` from `milestone/xxx` (if exists)
   - **New milestone**: Create `milestone/{{.milestone_name}}` from main development branch first
   
   Execute branching:
   ```bash
   # For simple features or if no milestone branch exists:
   git checkout -b task-{{.task_id}}-{{.brief_description}}
   
   # For milestone tasks (if milestone branch exists):
   git checkout milestone/{{.milestone_name}}
   git checkout -b task-{{.task_id}}-{{.brief_description}}
   ```

7. Update task in Backlog.md:
   ```
   backlog task edit {{.task_id}} -s "In Progress" -a @{{.username}}
   ```

8. Add implementation plan if missing:
   - Check for existing plan in task
   - If missing, analyze:
     - Related documentation in `backlog/docs/`
     - Parent task (if subtask)
     - Similar completed tasks
     - Codebase patterns from CLAUDE.md
     - Project's git workflow patterns
   - Generate and add plan:
     ```
     backlog task edit {{.task_id}} --plan "{{.generated_plan}}"
     ```

9. Set up development environment:
   - Create initial commit:
     ```
     git commit --allow-empty -m "task-{{.task_id}}: Start work on {{.task_title}}"
     ```
   - Push branch to remote:
     ```
     git push -u origin task-{{.task_id}}-{{.brief_description}}
     ```

10. Provide development summary:
    - Task: ID, title, and acceptance criteria
    - **Branch Strategy**: Simple feature vs milestone approach
    - **Base Branch**: Which branch we started from (main development branch or milestone/xxx)
    - **Feature Branch**: Name and remote URL
    - **Milestone Context**: If part of larger milestone, show related tasks
    - Implementation plan (first 3 steps)
    - Relevant files to review
    - **Merge Target**: Where this will merge when done (main development branch or milestone branch)
    - Next actions to take
    
11. Show related workflow guidance:
    - Reference project's git workflow documentation (if available)
    - Show daily workflow pattern for this task type
    - Explain merge strategy when task is complete