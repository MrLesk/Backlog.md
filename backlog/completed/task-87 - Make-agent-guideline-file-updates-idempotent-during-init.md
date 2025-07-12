---
id: task-87
title: Make agent guideline file updates idempotent during init
status: Done
assignee:
  - '@claude'
created_date: '2025-06-19'
updated_date: '2025-06-20'
labels:
  - enhancement
  - cli
  - init
dependencies: []
---

## Description

Currently, when running `backlog init` and selecting agent guideline files (CLAUDE.md, AGENTS.md, .cursorrules), the system should append Backlog.md-specific instructions to existing files. However, if init is run multiple times, content may be duplicated. We need to make this process idempotent - ensuring that the Backlog.md guidelines are only added once, regardless of how many times init is executed.

## Acceptance Criteria

- [x] Running `backlog init` multiple times does not duplicate agent guideline content
- [x] Existing agent guideline files are preserved with Backlog.md content appended at the bottom
- [x] If Backlog.md content already exists in the file, it is not added again
- [x] Each agent file type has a unique marker/identifier to detect existing Backlog.md content
- [x] New files are created normally if they don't exist
- [x] The appended content includes clear section headers indicating it's from Backlog.md
- [x] All three agent file types (.cursorrules, CLAUDE.md, AGENTS.md) handle idempotency correctly
- [x] No data loss occurs when updating existing files

## Implementation Plan

1. **Add Content Markers**
   - Define unique markers/comments for each file type to identify Backlog.md sections
   - Examples: `<!-- BACKLOG.MD GUIDELINES START -->` and `<!-- BACKLOG.MD GUIDELINES END -->`

2. **Implement Detection Logic**
   - Check if files exist before writing
   - Read existing content and search for Backlog.md markers
   - Skip appending if markers are found

3. **Update Append Logic**
   - Wrap Backlog.md content with markers
   - Ensure proper newlines/spacing when appending
   - Preserve existing file content

4. **Test Scenarios**
   - Test with non-existent files
   - Test with existing files without Backlog.md content
   - Test with files already containing Backlog.md content
   - Test running init multiple times in succession

## Implementation Notes

*Created by @claude on 2025-06-20*

### Approach Taken

The solution implements idempotent behavior for agent guideline file updates by using unique markers to identify existing Backlog.md content. The implementation follows these key principles:

1. **Content Markers**: Added different marker types based on file format:
   - For markdown files (CLAUDE.md, AGENTS.md, README.md): HTML comments `<!-- BACKLOG.MD GUIDELINES START/END -->`
   - For .cursorrules: Markdown-style comments `# === BACKLOG.MD GUIDELINES START/END ===`

2. **Detection Logic**: Before appending content, the system checks if the start marker already exists in the file
3. **Idempotent Updates**: If markers are found, the file is skipped entirely to prevent duplication
4. **Content Wrapping**: All Backlog.md guidelines are now wrapped with appropriate markers when added

### Technical Decisions and Trade-offs

- **Marker Strategy**: Used different comment styles for different file types since .cursorrules doesn't support HTML comments
- **Skip vs Replace**: Chose to skip files with existing markers rather than replace content to avoid potentially overwriting user modifications between markers
- **Simple Detection**: Used basic string matching rather than more complex parsing for simplicity and performance
- **Backward Compatibility**: Existing files without markers will get markers added on first run, but won't break existing functionality

### Files Modified

1. **`/Users/agavr/projects/Backlog.md/src/agent-instructions.ts`**:
   - Added `getMarkers()` function to determine appropriate markers for each file type
   - Added `hasBacklogGuidelines()` function to check for existing markers
   - Added `wrapWithMarkers()` function to wrap content with appropriate markers
   - Modified `addAgentInstructions()` function to implement idempotent behavior
   - Preserved Windows compatibility with synchronous file reading

2. **`/Users/agavr/projects/Backlog.md/src/test/agent-instructions.test.ts`**:
   - Added comprehensive tests for idempotent behavior
   - Added tests for different file type marker handling
   - Updated existing tests to account for wrapped content format
   - Tests verify no content duplication when run multiple times

### Testing Results

All new tests pass, including:
- Idempotent behavior when running multiple times
- Proper marker insertion for different file types  
- Preservation of existing content
- No data loss during updates
- Correct handling of non-existent files

### Follow-up Tasks

No immediate follow-up tasks required. The implementation fully satisfies all acceptance criteria and maintains backward compatibility.
