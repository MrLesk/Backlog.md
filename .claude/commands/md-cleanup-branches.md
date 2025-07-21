# Cleanup Branches

Clean up local and remote branches following the new git workflow structure with dev, milestone, and task branches.

## Prompt

You are my development assistant. I want to clean up old branches following our project's git workflow.

1. Analyze our current branch structure:
   ```bash
   # Show current branch structure
   git branch -av
   
   # Show branch relationships
   git show-branch --all
   ```

2. Get all completed tasks from the last 30 days:
   ```
   backlog task list -s "Done" --plain
   ```

3. Identify branch types in your project structure:
   - **Protected branches**: `main`, `master`, `develop`, `dev`, `production`, `staging` (never delete)
   - **Milestone branches**: `milestone/*` (analyze completion status)
   - **Task branches**: `task-*` (check against completed tasks)
   - **Archive branches**: Already tagged as `archive/*` (can delete locals)
   - **Legacy branches**: Old naming patterns or orphaned branches

4. Analyze milestone branches:
   ```bash
   # Find all milestone branches
   git branch -a | grep milestone/
   
   # For each milestone branch, check:
   # - Associated tasks completion status
   # - Whether milestone is merged to dev
   # - Last activity date
   git for-each-ref --format='%(refname:short) %(committerdate:relative) %(subject)' refs/heads/milestone/
   ```

5. Analyze task branches against completed tasks:
   ```bash
   # Find all task branches
   git branch -a | grep -E "task-[0-9]+"
   
   # Check merge status against main development branch
   DEV_BRANCH=$(git branch -a | grep -E "(dev|develop|main|master)" | grep origin | head -1 | sed 's/.*origin\///')
   git branch --merged $DEV_BRANCH | grep "task-"
   git branch --no-merged $DEV_BRANCH | grep "task-"
   
   # Check merge status against milestone branches
   for milestone in $(git branch | grep milestone/); do
     echo "=== $milestone ==="
     git branch --merged $milestone | grep "task-"
   done
   ```

6. Create cleanup categories following new workflow:

   **✅ Safe to Delete (Merged & Complete):**
   - Task branches merged to main development branch with completed tasks
   - Task branches merged to milestone branches with completed tasks
   - Milestone branches fully merged to main development branch

   **⚠️ Review Needed (Unmerged but Complete):**
   - Task branches for completed tasks but not merged (check if work was duplicated elsewhere)
   - Milestone branches with all tasks complete but not merged to main development branch

   **🔄 Active (Keep):**
   - Task branches for in-progress tasks with recent commits
   - Milestone branches with incomplete tasks
   - All protected branches (main, master, develop, dev, production, staging)

   **🗑️ Stale (Consider Deletion):**
   - Task branches with no matching tasks and no commits >14 days
   - Abandoned milestone branches with no activity >30 days
   - Legacy branches from old naming conventions

   **🏷️ Archive Branches (Local Cleanup):**
   - Local copies of branches we've tagged as archive/* (can delete safely)

7. For each category, provide detailed analysis:
   ```
   | Branch Name | Type | Task Status | Merged To | Last Activity | Action |
   |-------------|------|-------------|-----------|---------------|---------|
   | task-0004-forms | Task | Done | dev | 3 days ago | ✅ Safe to delete |
   | milestone/stats-v1 | Milestone | 80% complete | Not merged | 1 week ago | ⚠️ Review needed |
   | task-0099-orphan | Task | No task found | None | 20 days ago | 🗑️ Consider deletion |
   ```

8. Generate workflow-compliant cleanup commands:

   **Safe Deletions (Merged branches for completed tasks):**
   ```bash
   # Delete merged task branches (local)
   git branch -d task-0001-feature task-0002-bugfix
   
   # Delete remote task branches
   git push origin --delete task-0001-feature task-0002-bugfix
   
   # Delete completed milestone branches (after confirming merge to dev)
   git branch -d milestone/completed-feature-set
   git push origin --delete milestone/completed-feature-set
   ```

   **Archive Branch Cleanup:**
   ```bash
   # These are safe since we have archive tags
   git branch -d flutterflow  # If still exists locally
   # (Remote archive branches were already cleaned up)
   ```

   **Stale Branch Cleanup (Use with caution):**
   ```bash
   # Force delete unmerged stale branches
   git branch -D task-0099-orphan task-0100-abandoned
   git push origin --delete task-0099-orphan task-0100-abandoned
   ```

9. Milestone branch analysis:
   - For each milestone branch, show:
     - Associated tasks (complete vs incomplete)
     - Whether milestone is ready to merge to dev
     - Recommendation (keep working, merge to dev, or archive)

10. Provide workflow-compliant summary:
    - **Protected Branches**: Confirmed safe (main development and production branches)
    - **Active Development**: Current milestone and task branches kept
    - **Cleaned Up**: Count of deleted task branches
    - **Archive Cleanup**: Local archive branch cleanup
    - **Recommendations**: 
      - Milestone branches ready to merge to main development branch
      - Tasks that need proper completion workflow
      - Any workflow deviations discovered

11. Show next steps for ongoing branch hygiene:
    - How to use finish-task workflow to avoid accumulation
    - When to create/merge milestone branches
    - Reference to project's workflow documentation for preventing future cleanup needs