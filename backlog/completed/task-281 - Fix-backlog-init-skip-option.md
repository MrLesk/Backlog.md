---
id: task-281
title: Fix backlog init skip option
status: Done
assignee:
  - '@codex'
created_date: '2025-09-27 16:32'
updated_date: '2025-09-27 17:07'
labels:
  - bug
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary
Selecting the "Do not add instructions" option during `backlog init` causes the wizard to show "Please select at least one agent instruction file before continuing." even though the user explicitly chose to skip agent instructions.

## Observed Behavior
1. Run `backlog init`.
2. Use the multiselect prompt to highlight "Do not add instructions (danger, this will make backlog not usable with ai agents)" and press enter to continue.
3. The CLI prints the validation error and the prompt restarts instead of accepting the skip decision.

## Expected Behavior
When the skip option is chosen, the wizard should accept the choice and proceed without creating agent instruction files.

## Notes
`processAgentSelection` treats a selection containing only "none" as invalid and forces a retry inside the interactive flow. The init command should treat that case as a valid decision and move forward.,
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interactive backlog init accepts the skip option without showing a validation error.
- [x] #2 Interactive backlog init still requires a retry when no option is chosen or when only the placeholder row is highlighted.
- [x] #3 Automated coverage verifies that selecting only the skip option results in initialization continuing with zero agent instruction files.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update `processAgentSelection` to treat a lone "none" selection as an explicit skip (no retry) while still deduping/ignoring placeholders, and surface a skip indicator alongside the files array.
2. Adjust the `backlog init` agent-instruction prompt handling to honor the skip outcome without forcing the retry loop, keeping existing behavior for other selections and fallbacks.
3. Strengthen coverage by extending `agent-selection` unit tests for the skip case and adding an integration regression test that proves `backlog init` proceeds with zero agent instruction files when the skip option is chosen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Updated `processAgentSelection` to treat a lone "none" selection as an explicit skip and return a skip flag for callers.
- Updated the `backlog init` agent selection flow to honor skip outcomes and log that instructions were skipped instead of forcing a retry.
- Added regression coverage for the skip path in `agent-selection` and CLI integration tests to ensure no agent instruction files are produced when skipping.
- Tests: `bunx tsc --noEmit`, `bun test`, `bun run check .`
<!-- SECTION:NOTES:END -->
