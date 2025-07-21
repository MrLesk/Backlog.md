# Finish Task

Complete workflow for finishing a task following the new git workflow with proper merging strategy to dev or milestone branches.

## Parameters
- `task_ref`: The task reference (e.g., "task-0004", "0004", or just "4")

## Prompt

You are my development assistant. I'm ready to finish working on {{.task_ref}} following our project's git workflow.

1. Normalize the task reference and read task details:
   ```
   backlog task {{.normalized_task_ref}} --plain
   ```

2. Verify task readiness:
   - Check task is "In Progress"
   - Review acceptance criteria completion
   - Ensure we're on the correct branch: `git branch --show-current`
   - Identify target merge branch (dev or milestone branch)

3. Determine merge strategy:
   ```bash
   # Check current branch and its upstream
   git branch --show-current
   git branch -vv
   
   # Check if this is part of a milestone
   git branch -a | grep milestone/
   
   # Determine merge target based on branching strategy
   ```

4. Run quality checks:
   ```
   # Auto-detect and run tests
   if [ -f "package.json" ]; then
     npm test
   elif [ -f "pubspec.yaml" ]; then
     flutter test
   elif [ -f "Cargo.toml" ]; then
     cargo test
   fi
   
   # Auto-detect and run linter
   if [ -f "package.json" ]; then
     npm run lint
   elif [ -f "pubspec.yaml" ]; then
     flutter analyze
   elif [ -f "Cargo.toml" ]; then
     cargo clippy
   fi
   
   # Check for uncommitted changes
   git status
   ```

5. Update task file acceptance criteria:
   - Read the task file from `backlog/tasks/`
   - Help me check off completed acceptance criteria (change `- [ ]` to `- [x]`)
   - If any criteria are incomplete, ask whether to proceed

6. Prepare implementation notes:
   - Summarize the approach taken
   - List key files modified: `git diff --name-only HEAD~$(git rev-list --count HEAD ^$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'))`
   - Note any technical decisions or trade-offs
   - Document any deviations from the original plan
   - Note branch strategy used (simple feature vs milestone)

7. Commit final changes:
   ```
   git add -A
   git commit -m "task-{{.task_id}}: Complete implementation

   {{.implementation_summary}}"
   ```

8. Push changes:
   ```
   git push
   ```

9. Merge using workflow strategy:

   **For Simple Features (merge directly to main development branch):**
   ```bash
   # Detect and switch to main development branch
   DEV_BRANCH=$(git branch -a | grep -E "(dev|develop|main|master)" | grep origin | head -1 | sed 's/.*origin\///')
   git checkout $DEV_BRANCH
   git pull origin $DEV_BRANCH
   
   # Merge feature branch
   git merge task-{{.task_id}}-{{.brief_description}}
   git push origin $DEV_BRANCH
   
   # Clean up feature branch
   git branch -d task-{{.task_id}}-{{.brief_description}}
   ```

   **For Milestone Tasks (merge to milestone branch):**
   ```bash
   # Switch to milestone branch and get updates
   git checkout milestone/{{.milestone_name}}
   git pull origin milestone/{{.milestone_name}}
   
   # Merge task branch
   git merge task-{{.task_id}}-{{.brief_description}}
   git push origin milestone/{{.milestone_name}}
   
   # Clean up task branch
   git branch -d task-{{.task_id}}-{{.brief_description}}
   ```

   **Alternative: Create Pull Request (if using GitHub Pro or want review):**
   ```bash
   gh pr create --title "task-{{.task_id}}: {{.task_title}}" \
     --base {{.target_branch}} \
     --body "## Summary
   Completes task-{{.task_id}}: {{.task_title}}

   ## Branch Strategy
   - **Type**: {{.branch_strategy_type}} (Simple feature / Milestone task)
   - **Merge Target**: {{.target_branch}} (dev / milestone/xxx)

   ## Implementation Notes
   {{.implementation_notes}}

   ## Acceptance Criteria
   {{.checked_criteria}}

   ## Testing
   - [x] All tests pass
   - [x] Linting passes
   - [x] Manual testing completed

   ## Workflow Compliance
   - [x] Follows project's git workflow
   - [x] Proper branch naming convention
   - [x] Correct merge target identified

   Closes task-{{.task_id}}"
   ```

10. Update task status:
    ```
    backlog task edit {{.task_id}} -s Done \
      --notes "{{.implementation_notes}}"
    ```

11. Provide completion summary:
    - Task completed: ID and title
    - **Branch Strategy Used**: Simple feature or milestone approach
    - **Merge Target**: Which branch it was merged to
    - **Merge Status**: Direct merge completed or PR created
    - **Branch Cleanup**: Confirmation of feature branch deletion
    - **Milestone Status**: If part of milestone, show milestone progress
    - **Next Actions**: 
      - If milestone task: Check if milestone is ready for main development branch merge
      - If simple feature: Task is complete and in main development branch
    - Next suggested task

12. Show workflow guidance for what's next:
    - Reference project's git workflow documentation for next steps
    - If milestone complete: Show how to merge milestone to main development branch
    - If ready for release: Show release process to production branch