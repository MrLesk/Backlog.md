---
id: BACK-310
title: Strengthen Backlog workflow overview emphasis on reading detailed guides
status: In Progress
assignee:
  - '@claude'
created_date: '2025-10-27 21:37'
updated_date: '2026-07-04 14:08'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context
The Backlog.md workflow overview currently advises readers to consult the detailed task-creation, execution, and completion guides, but the message is easy to skip. We want to reinforce that contributors must review those guides before creating or modifying tasks so the workflow is consistently followed.

## Desired Outcome
Make the overview instructions more forceful and prominent about reading the supporting resources before proceeding with any task management actions.

## Suggested Changes
- Elevate the guidance (e.g., bold, callout, or structural change) so contributors cannot miss the requirement to read the other guides first.
- Clarify the consequences or rationale for reading the detailed guides before acting.
- Ensure the language stays concise and aligned with existing tone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The workflow overview document highlights (via formatting or callout) that contributors must read the detailed task guides before proceeding.
- [x] #2 The updated language adds a brief explanation of why reviewing the detailed guides is required.
- [x] #3 No conflicting or redundant instructions remain after the update.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Strengthen 'Detailed Guides' section in src/guidelines/cli-instructions/overview.md with a bold required-reading statement plus one-line rationale. 2. Mirror the emphasis in the MCP twin src/guidelines/mcp/overview.md (Detailed Guidance section) and add a matching bold line to src/guidelines/mcp/overview-tools.md; drop now-redundant trailing sentence. 3. Update the exact-string assertion in src/test/cli.test.ts. 4. Leave version-marker mechanics untouched (none present in these files). 5. Run tsc, biome, and scoped cli tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CLI overview (src/guidelines/cli-instructions/overview.md): 'Detailed Guides' section now opens with a bold Required statement (read the matching guide before creating/executing/finalizing; do not rely on the overview alone) plus a one-line rationale (overview says when, guides define the required procedure; skipping them produces inconsistent tasks and metadata). MCP twin (src/guidelines/mcp/overview.md): same emphasis in 'Detailed Guidance (Required)'; dropped the now-redundant trailing sentence 'These guides contain critical workflows...'. Tools-only variant (src/guidelines/mcp/overview-tools.md): added the matching bold requirement after the get_backlog_instructions explanation. Updated the exact-string assertion in src/test/cli.test.ts. No version-marker mechanics exist in these files; none touched.
<!-- SECTION:NOTES:END -->
