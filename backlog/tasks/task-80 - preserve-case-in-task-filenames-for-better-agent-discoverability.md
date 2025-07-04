---
id: task-80
title: Preserve case in task filenames for better agent discoverability
status: Done
assignee:
  - '@AI'
created_date: '2025-06-17'
updated_date: '2025-06-17'
labels:
  - enhancement
  - ai-agents
dependencies: []
---

## Description

Currently, task filenames are converted to lowercase which makes it difficult for AI agents to find tasks based on their titles. For example, a task titled "CLI Add Agent Instruction Prompt" becomes "cli-add-agent-instruction-prompt.md", creating a mismatch that complicates task discovery.

### Current Behavior
- Task titles are mixed case (e.g., "Fix Task List Ordering")
- Filenames are all lowercase (e.g., "fix-task-list-ordering.md")
- Agents searching for tasks by title have difficulty matching

### Proposed Solution
Remove the `.toLowerCase()` call from the `sanitizeFilename` method to preserve the original case of task titles in filenames.

## Acceptance Criteria

- [x] Remove `.toLowerCase()` from `sanitizeFilename` method in `file-system/operations.ts`
- [x] Add test cases to verify mixed-case filenames are preserved
- [x] Verify existing tasks with lowercase filenames can still be loaded
- [x] Test creating, updating, and archiving tasks with mixed-case titles
- [x] Ensure no breaking changes for existing projects
- [x] Update any affected documentation

## Implementation Notes

### Changes Made
1. Removed `.toLowerCase()` from the `sanitizeFilename` method in `src/file-system/operations.ts`
2. Added test case "should preserve case in filenames" to verify mixed-case preservation
3. Updated document test expectations to match preserved case ("API-Guide" instead of "api-guide")

### Testing Results
- All 246 tests pass
- Verified that new tasks preserve case: "Another Mixed Case Test" → "Another-Mixed-Case-Test.md"
- Verified that updating task titles preserves case: "UPDATED Title With CAPS" → "UPDATED-Title-With-CAPS.md"
- Existing lowercase filenames continue to work (backward compatible)

### Impact
- **Positive**: AI agents can now more easily match task titles to filenames
- **Backward Compatible**: Existing projects with lowercase filenames continue to work
- **No Breaking Changes**: File lookups remain case-sensitive as before

### Follow-up
- ✅ Added note in CLAUDE.md about preserved case in filenames
- The filename format is now documented for AI agents
