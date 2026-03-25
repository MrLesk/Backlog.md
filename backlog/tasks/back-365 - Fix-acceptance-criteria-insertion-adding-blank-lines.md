---
id: BACK-365
title: Fix acceptance criteria insertion adding blank lines
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 21:42'
updated_date: '2026-01-16 17:04'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users report that adding a new acceptance criteria always inserts an empty line above it, creating unintended blank lines between criteria groups. The acceptance criteria list should preserve intentional spacing only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Adding a new acceptance criteria does not insert an extra empty line above the new entry.
- [x] #2 Existing acceptance criteria lists remain unchanged unless the user explicitly adds blank lines.
- [x] #3 Adding multiple acceptance criteria in sequence results in a contiguous list without blank lines by default.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Root Cause
When extracting existing AC body from markdown, the regex captures a trailing newline before `<!-- AC:END -->`. When split by `\n`, this produces an empty string at the end of `sourceLines`. The loop preserves non-checkbox lines (including this empty string), causing a blank line before newly added criteria.

## Fix
Add `.trimEnd()` to existingBody before splitting in `composeAcceptanceCriteriaBody()` (line 386 of structured-sections.ts):
```typescript
const sourceLines = existingBody ? existingBody.replace(/\r\n/g, "\n").trimEnd().split("\n") : [];
```

## Testing
1. Add test case for blank line bug
2. Verify existing AC tests pass
3. Clean up test task BACK-367
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

**Root Cause**: The `composeAcceptanceCriteriaBody()` function in `src/markdown/structured-sections.ts` was splitting the existingBody without trimming trailing newlines. This caused empty strings to appear at the end of `sourceLines` array, which were then preserved as blank lines when adding new criteria.

**Fix**: Added `.trimEnd()` to the existingBody before splitting (line 387):
```typescript
const sourceLines = existingBody ? existingBody.replace(/\r\n/g, "\n").trimEnd().split("\n") : [];
```

**Testing**:
- Added unit test in `acceptance-criteria-manager.test.ts` that verifies no blank lines are inserted when adding new criteria
- Manually verified fix works with fresh tasks
- All related AC tests pass (31/36 - 5 failures are pre-existing unrelated issues)
<!-- SECTION:NOTES:END -->
