# Work on Task

Prepares and starts work on a specific task by reading its details, checking dependencies, creating a branch, and updating its status.

## Parameters
- `task_ref`: The task reference (e.g., "task-0004", "0004", "0004.03", or just "4")

## Prompt

You are my development assistant. I want to start working on a specific task.

**When creating implementation plans, use ultrathink mode** - engage in deep, critical analysis to ensure comprehensive planning that considers all edge cases and potential challenges.

1.  First, normalize the task reference:
    - If it's just a number like "4" or "0004", convert it to "task-0004"
    - If it's a subtask like "0004.03", convert it to "task-0004.03"
    - If it already has the "task-" prefix, use it as-is

2.  Read the task details using: `backlog task {{.normalized_task_ref}} --plain`

3.  Check the task status:
    - If it's already "In Progress", ask if I want to continue working on it
    - If it's "Done", inform me and ask if I want to reopen it
    - If it's "To Do", proceed to the next steps

4.  Check dependencies:
    - If the task has dependencies, verify all are marked as "Done"
    - If any dependencies are incomplete, list them and ask if I want to proceed anyway

5.  Create a feature branch following new git workflow (if task is not already in progress):
    - First, ensure we're on the correct base branch:
      ```bash
      # Always start from main development branch
      DEV_BRANCH=$(git branch -a | grep -E "(dev|develop|main|master)" | grep origin | head -1 | sed 's/.*origin\///')
      git checkout $DEV_BRANCH
      git pull origin $DEV_BRANCH
      ```
    - Determine branching strategy:
      - **Simple feature**: Branch directly from main development branch
      - **Milestone task**: Check if milestone branch exists, branch from it if so
    - Extract a brief description from the task title (remove special characters, use hyphens)
    - Use new naming convention: `task-{{.task_id}}-{{.brief_description}}` (not feature/)
    - Show the git command: `git checkout -b task-{{.task_id}}-{{.brief_description}}`

6.  Update the task status:
    - Move it to "In Progress" using: `backlog task edit {{.task_id}} -s "In Progress"`
    - If you know my username, assign it to me: `backlog task edit {{.task_id}} -a @{{.username}} -s "In Progress"`

7.  Add an implementation plan if missing:
    - If the task doesn't have an implementation plan, **use ultrathink mode** to create a comprehensive one by:
      a. Check for PRD/PRP documents: Look in `backlog/docs/` for any Product Requirements Documents or Project Requirements Plans
      b. Review related tasks:
         - If this is a subtask, read the parent task for context
         - Look for previous related tasks (with lower IDs) that might provide patterns or context
      c. Analyze existing code:
         - Check CLAUDE.md and any .cursorrules files for development guidelines
         - Look for similar implementations in the codebase
         - Review relevant files mentioned in the task description
      d. Based on all gathered information, create a detailed implementation plan that:
         - Breaks down the work into clear, numbered steps
         - Identifies specific files to modify or create
         - Includes testing approach
         - Notes any technical decisions or trade-offs
    - Add the plan using: `backlog task edit {{.task_id}} --plan "Detailed implementation plan:\n1. First step...\n2. Second step...\n3. Testing approach...\n4. etc..."`
    - Show me the proposed plan before executing the command

8.  Provide a summary:
    - Task title and ID
    - Current branch name
    - Key acceptance criteria
    - Any important notes or context
    - If implementation plan exists: Show the first steps to begin with
    - If implementation plan was just created: Wait for approval before proceeding