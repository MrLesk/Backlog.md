# Milestone Review

Generates a summary of all tasks in a milestone, grouped by label, for release notes. If no milestone is specified, lists all available milestones.

## Parameters
- `milestone_id`: (Optional) The milestone ID to review. If not provided, lists all available milestones.

## Prompt

You are my development assistant helping with milestone management and release notes.

{{#if milestone_id}}
I want to review milestone `{{milestone_id}}`. Generate a detailed summary of all tasks associated with this milestone.

1. First, verify the milestone exists in configuration:
   ```
   cat backlog/config.yml | grep -A 10 "milestones:" | grep "{{milestone_id}}"
   ```

2. Get all tasks and filter by milestone label:
   ```
   backlog task list --plain
   ```

3. Analyze task files to find tasks with this milestone label:
   - Look through `backlog/tasks/` directory for tasks containing `{{milestone_id}}` in their labels
   - Use command: `grep -r "- {{milestone_id}}" backlog/tasks/ | head -10`
   - Count tasks by status for this milestone

4. Check milestone branch status and related task branches:
   ```bash
   # Look for milestone branch
   git branch -a | grep "milestone/.*{{milestone_id}}"
   
   # Find task branches related to this milestone (by matching task IDs found above)
   git branch -a | grep -E "task-[0-9]+"
   
   # Check recent activity on milestone branch (if exists)
   git log --oneline -5 milestone/{{milestone_id}}* 2>/dev/null || echo "No milestone branch found"
   
   # Check for unmerged task branches related to this milestone
   DEV_BRANCH=$(git branch -a | grep -E "(dev|develop|main|master)" | grep origin | head -1 | sed 's/.*origin\///')
   git branch --no-merged $DEV_BRANCH | grep task-
   ```

5. Group tasks by their additional labels and branch status:
   - `frontend` - UI/UX improvements and features
   - `backend` - API, database, and server changes  
   - `bug` - Bug fixes and corrections
   - `enhancement` - Feature improvements
   - `docs` - Documentation updates
   - Other labels as found

4. For each group, list:
   - Task ID and title
   - Brief description of what was accomplished
   - Key acceptance criteria that were met

6. Generate comprehensive release notes format:
   ```markdown
   # {{milestone_id}} Release Notes
   
   ## Milestone Overview
   - **Branch**: milestone/{{milestone_id}}-* (if exists)
   - **Total Tasks**: X completed, Y in progress, Z pending
   - **Completion**: XX%
   
   ## Frontend Changes
   - [task-0001] Feature name: Description
     - **Branch**: task-0001-feature-name (merged/active/missing)
   
   ## Backend Changes  
   - [task-0002] API improvement: Description
     - **Branch**: task-0002-api-update (merged/active/missing)
   
   ## Bug Fixes
   - [task-0003] Fixed issue: Description
     - **Branch**: task-0003-bug-fix (merged/active/missing)
   
   ## Branch Status Summary
   - **Milestone Branch**: milestone/{{milestone_id}}-v1 (active/ready for merge/missing)
   - **Active Task Branches**: List of unmerged task branches
   - **Merged Task Branches**: Recently merged branches for this milestone
   ```

7. Provide comprehensive statistics and recommendations:
   - Total tasks completed vs total tasks in milestone
   - Breakdown by category (frontend, backend, etc.)
   - Branch workflow status:
     - Whether milestone branch exists and is up to date
     - Task branches that need to be merged to milestone branch
     - Task branches that need to be created for in-progress tasks
   - Any incomplete tasks still associated with milestone
   - Recommendations for next steps:
     - Create milestone branch if missing
     - Merge ready task branches to milestone
     - Merge milestone to main development branch if ready for release
{{else}}
I want to see all available milestones to choose which one to review.

1. First, get the configured milestones from backlog configuration:
   ```
   cat backlog/config.yml | grep -A 5 "milestones:"
   ```

2. Get all tasks to analyze milestone assignments:
   ```
   backlog task list --plain
   ```

3. For each milestone found in config.yml, analyze task distribution:
   - Count tasks by status (To Do, In Progress, Done) that have the milestone as a label
   - Look through task files in `backlog/tasks/` for label assignments
   - Calculate completion percentages

4. Alternative milestone detection (if not in config):
   - Check task titles for version patterns (v1.0, v2.1, etc.)
   - Look for release-related keywords in task descriptions
   - Identify common label themes that might represent milestones

5. For each milestone, provide summary:
   - Milestone name/ID
   - Number of tasks by status:
     - ✅ Completed (Done)
     - 🔄 In Progress  
     - 📋 To Do
   - Overall completion percentage
   - Key focus areas (based on task titles/descriptions)

6. Analyze a few sample task files to confirm milestone labels:
   ```bash
   # Check some recent task files for milestone labels
   head -15 backlog/tasks/task-*.md | grep -A 2 -B 2 "labels:"
   ```

7. Suggest which milestone might be ready for review:
   - Milestones with high completion rates (>70%)
   - Recently completed milestones
   - Milestones with all tasks marked "Done"

8. Show how to review a specific milestone:
   ```
   /md-milestone-review milestone_id=habits
   /md-milestone-review milestone_id=stats
   ```

9. Check for milestone-related branches (based on git workflow guide):
   ```bash
   # Look for milestone branches
   git branch -a | grep "milestone/"
   
   # Check recent activity on milestone branches
   git for-each-ref --format='%(refname:short) %(committerdate:relative) %(subject)' refs/heads/milestone/
   
   # Look for task branches that might be related to milestones
   git branch -a | grep -E "(task-[0-9]+|milestone/)"
   ```

10. Analyze branch-to-milestone relationships:
    - Match task branches to milestone labels
    - Check if milestone branches exist for active milestones
    - Identify orphaned branches or missing milestone branches
    - Show recent commit activity on milestone-related branches

11. Provide comprehensive milestone status overview:
    ```
    | Milestone | Completed | In Progress | To Do | Progress | Branch Status |
    |-----------|-----------|-------------|-------|----------|---------------|
    | habits    | X tasks   | Y tasks     | Z     | XX%      | milestone/habits-v1 (active) |
    | stats     | A tasks   | B tasks     | C     | YY%      | No milestone branch |
    ```

12. Recommend next actions:
    - Which milestones need milestone branches created
    - Which milestone branches are ready for merging to main development branch
    - Task branches that should be merged to milestone branches
    - Cleanup recommendations for completed milestones
{{/if}}