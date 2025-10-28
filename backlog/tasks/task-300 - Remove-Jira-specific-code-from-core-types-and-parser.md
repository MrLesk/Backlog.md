---
id: task-300
title: Remove Jira-specific code from core types and parser
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 11:24'
updated_date: '2025-10-13 11:32'
labels: []
dependencies:
  - task-299
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Clean up core backlog.md codebase by removing all Jira-specific field definitions and parsing logic. Implement dynamic field extension in parser to automatically pass through all frontmatter fields, allowing plugins to define their own custom fields without modifying core. This completes the plugin architecture refactoring.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Remove jiraKey, jiraUrl, jiraLastSync, jiraSyncState from Task interface in src/types/index.ts
- [x] #2 Add index signature to Task interface to allow dynamic fields: [key: string]: unknown
- [x] #3 Update parser in src/markdown/parser.ts to pass through all frontmatter fields
- [x] #4 Remove hardcoded Jira field parsing (jira_key, jira_url, etc.) from parser
- [x] #5 Parser automatically includes any custom frontmatter fields in parsed Task object
- [x] #6 Core remains completely agnostic of Jira or any other plugin fields
- [x] #7 Existing functionality preserved - all standard fields still work
- [x] #8 Tests updated to verify dynamic field pass-through works correctly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove Jira-specific fields from Task interface in types/index.ts
2. Add index signature to Task interface to allow dynamic fields
3. Update parser to pass through all unknown frontmatter fields as dynamic properties
4. Remove hardcoded Jira field parsing from parser.ts
5. Remove Jira display code from task-viewer-with-search.ts
6. Test that existing tasks still parse correctly
7. Verify that custom fields can be added via frontmatter
8. Ensure backward compatibility
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed Jira-specific code from core to enable plugin architecture.

Changes:
- Removed jiraKey, jiraUrl, jiraLastSync, jiraSyncState from Task interface
- Added index signature `[key: string]: unknown` to Task interface
- Used spread operator in parser to include all frontmatter fields automatically
- Removed hardcoded Jira display sections from task-viewer-with-search.ts
  - Removed Jira metadata section from formatTaskPlainText (lines 1159-1176)
  - Removed Jira metadata section from generateDetailContent (lines 1266-1282)

How it works:
- TypeScript index signature allows any property to be added to Task objects
- Parser spreads all frontmatter fields using `...frontmatter` at the end
- Plugins can now add custom fields (jiraKey, githubPr, etc.) without core changes
- Unknown fields automatically pass through from frontmatter to Task object

Backward compatibility:
- Existing tasks with Jira fields will still parse correctly
- Fields are accessible via task["jiraKey"] or task.jiraKey (with type assertion)
- No breaking changes for plugins that read these fields

Benefits:
- Core is now plugin-agnostic
- Any plugin can add custom fields
- No coupling between core and specific integrations
- Enables unlimited extensibility
<!-- SECTION:NOTES:END -->
