---
id: task-295
title: Enhance backlog CLI to display Jira metadata in task views
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 06:11'
updated_date: '2025-10-13 10:14'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After task-294 integrates Jira frontmatter updates, enhance the backlog CLI to display Jira metadata when viewing tasks. This improves visibility of Jira links without needing to open the markdown file directly.…
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Jira metadata fields added to Task interface
- [x] #2 Parser extracts Jira fields from frontmatter
- [x] #3 Plain text view displays Jira metadata when present
- [x] #4 TUI view displays Jira metadata when present
- [x] #5 Jira section not displayed when fields are absent
- [x] #6 All existing tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Jira metadata fields to Task interface as optional fields
2. Update parseTask to extract Jira fields from frontmatter if they exist
3. Update formatTaskPlainText to display Jira metadata section when fields exist
4. Update generateDetailContent (TUI) to display Jira metadata section when fields exist
5. Test plain text output with and without Jira metadata
6. Test TUI display with and without Jira metadata
7. Run existing tests to ensure no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

Successfully enhanced the backlog CLI to display Jira metadata in task views without modifying core Backlog.md code to depend on the backlog-jira plugin.

### Approach

The implementation treats Jira fields as optional metadata that can be displayed when present, without creating a dependency on the plugin:

1. Added optional Jira fields to the Task interface as generic properties
2. Parser extracts Jira fields from frontmatter if they exist (no validation required)
3. Display functions check for presence of fields and show them conditionally

### Changes Made

**1. src/types/index.ts:**
- Added 4 optional Jira fields to Task interface:
  - jiraKey: string (Jira issue key like "PROJ-123")
  - jiraUrl: string (full URL to Jira issue)
  - jiraLastSync: string (timestamp of last sync)
  - jiraSyncState: string (sync state like "InSync")
- Fields are optional and commented as populated by backlog-jira plugin

**2. src/markdown/parser.ts:**
- Updated parseTask to extract Jira fields from frontmatter
- Maps snake_case frontmatter keys to camelCase Task properties
- Fields are optional - no errors if missing

**3. src/ui/task-viewer-with-search.ts:**
- Updated formatTaskPlainText to display "Jira Integration" section when any Jira field is present
- Shows: Key, URL, Last Sync, and Sync State (only fields that exist)
- Section is completely omitted when no Jira fields exist
- Updated generateDetailContent (TUI) to display Jira metadata with colors
- Uses cyan for Key, blue for URL, yellow for Sync State

### Key Design Decisions

1. **No plugin dependency**: Core code doesn't know about backlog-jira plugin\n2. **Optional display**: Jira section only appears when fields exist\n3. **Graceful handling**: Missing fields don't cause errors or display issues\n4. **Consistent formatting**: Matches existing metadata display patterns\n\n### Testing\n\n- TypeScript compilation: ✓ All code compiles cleanly (no errors in main code)\n- Unit tests: ✓ 723 tests pass (2 pre-existing failures in backlog-jira plugin)\n- Display logic: ✓ Jira section only shows when fields present\n- Plain text view: ✓ Displays Jira metadata correctly\n- TUI view: ✓ Displays Jira metadata with proper formatting\n\n### Files Modified\n\n- src/types/index.ts (+4 lines: Jira field definitions)\n- src/markdown/parser.ts (+4 lines: Jira field extraction)\n- src/ui/task-viewer-with-search.ts (+38 lines: Jira metadata display)\n\n### Verification\n\nThe implementation maintains clean separation between core Backlog.md and the backlog-jira plugin:\n- No imports from backlog-jira\n- No conditional logic based on plugin presence\n- No breaking changes to existing functionality\n- Jira metadata displayed automatically when present in frontmatter
<!-- SECTION:NOTES:END -->
