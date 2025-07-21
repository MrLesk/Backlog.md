# Task Sync

Synchronize task statuses based on git branch activity and PR status.

## Prompt

You are my development assistant. I want to sync Backlog.md task statuses with actual git activity.

1. Gather git information:
   ```
   # Current branch
   git branch --show-current
   
   # All branches with last commit info
   git for-each-ref --format='%(refname:short) %(committerdate:relative) %(subject)' refs/heads/
   
   # Open pull requests (if gh CLI available)
   gh pr list --state all --limit 50
   ```

2. Get all non-archived tasks:
   ```
   backlog task list --plain
   ```

3. Analyze mismatches:

   **Tasks that should be "In Progress":**
   - Status is "To Do" but has an active branch with recent commits
   - Has an open PR

   **Tasks that might be "Done":**
   - Status is "In Progress" but PR is merged
   - Branch is deleted after merge

   **Tasks that might be "Blocked":**
   - No commits in 7+ days on active branch
   - PR has requested changes

   **Orphaned branches:**
   - Branches without corresponding tasks
   - Suggest creating tasks or deleting branches

4. For each mismatch found:
   - Show current status vs suggested status
   - Provide evidence (branch activity, PR status)
   - Show the command to fix it

5. Generate sync commands:
   ```bash
   # Update tasks to In Progress
   backlog task edit 15 -s "In Progress"  # Has active branch: task-15-feature
   
   # Update tasks to Done
   backlog task edit 8 -s "Done"  # PR #123 merged
   
   # Update tasks to Blocked
   backlog task edit 22 -s "Blocked"  # No commits since Oct 15
   ```

6. Identify additional issues:
   - Multiple branches for one task
   - Multiple tasks sharing a branch
   - Very old "In Progress" tasks

7. Provide summary report:
   - Tasks synced
   - Issues found
   - Recommendations for workflow improvement