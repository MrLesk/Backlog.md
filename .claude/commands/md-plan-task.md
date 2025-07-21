# Plan Task

Generates a detailed, step-by-step implementation plan for a specific task.

## Parameters
- `task_id`: The ID of the task to plan

## Prompt

You are a senior software engineer. Your task is to create a detailed implementation plan for the following task.

**Use ultrathink mode for this planning process** - engage in deep, critical analysis to ensure the plan is comprehensive, considers all edge cases, and addresses potential challenges proactively.

1.  First, read the task details using the command: `backlog task {{.task_id}} --plain`

2.  Gather comprehensive context:
    a. **Check for PRD/PRP documents**: Look in `backlog/docs/` for any Product Requirements Documents or Project Requirements Plans that relate to this task
    b. **Review related tasks**:
       - If this is a subtask, read the parent task for context using: `backlog task {{.parent_id}} --plain`
       - Look for previous related tasks (with lower IDs) that might provide patterns or implementation context
       - Check if there are any completed similar tasks to learn from their implementation notes
    c. **Analyze existing code and rules**:
       - Read CLAUDE.md for project-specific guidelines and architecture
       - Check any .cursorrules files for development constraints
       - Look for similar implementations in the codebase that could serve as patterns
       - Review relevant files mentioned in the task description or acceptance criteria
    d. **Check project decisions**: Look in `backlog/decisions/` for any architectural or technical decisions that might affect this implementation

3.  Based on all gathered information, formulate a detailed implementation plan that includes:
    - Clear, numbered steps breaking down the work
    - Specific files to be modified or created
    - Technical approach and any algorithms or patterns to use
    - Testing strategy (unit tests, integration tests, manual testing)
    - Any technical decisions or trade-offs to consider
    - Dependencies or prerequisites
    - Estimated complexity and potential risks

4.  Present the proposed plan to me for review before adding it to the task

5.  After approval, execute the command to add the plan:
    `backlog task edit {{.task_id}} --plan "Detailed implementation plan:\n1. [First step]...\n2. [Second step]...\n3. [Testing approach]...\n4. [etc...]"`