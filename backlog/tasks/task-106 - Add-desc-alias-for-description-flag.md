---
id: task-106
title: Add --desc alias for description flag
status: Done
assignee: []
created_date: '2025-07-03'
updated_date: '2025-07-04'
labels: []
dependencies: []
---

## Description

Add --desc as an additional alias for the -d/--description flag to provide more convenience when creating tasks with descriptions.

## Acceptance Criteria

- [x] The --desc flag works as an alias for --description
- [x] All three flags (-d, --description, --desc) work interchangeably
- [x] Help text shows all three aliases
- [x] Tests verify all aliases work correctly
- [x] Documentation is updated to reflect the new alias

## Implementation Plan

1. Analyze current CLI argument parsing for description flags
2. Add --desc alias to task create, edit, and draft create commands
3. Update option handling logic to support both --description and --desc
4. Create comprehensive test suite to verify functionality
5. Update documentation to include the new alias
6. Run tests and ensure all functionality works correctly

## Implementation Notes

**Approach taken:**
- Added `--desc` as a separate option in Commander.js alongside existing `-d, --description`
- Updated option handling logic in both `buildTaskFromOptions` and task edit command
- Created comprehensive test suite to verify functionality

**Features implemented:**
- `--desc` alias for task create command
- `--desc` alias for task edit command  
- `--desc` alias for draft create command
- Help text shows all available aliases
- Proper handling when both `--description` and `--desc` are provided (uses first one found)

**Technical decisions and trade-offs:**
- **Separate options approach**: Used separate `.option()` calls instead of trying to combine flags, as Commander.js doesn't support multiple long flags in a single option
- **Priority handling**: Used `options.description || options.desc` to handle cases where both are provided
- **Comprehensive testing**: Created dedicated test file to ensure all functionality works correctly

**Modified files:**
- `src/cli.ts`: Added `--desc` options to all three commands and updated option handling logic
- `src/test/desc-alias.test.ts`: Created comprehensive test suite
- `src/guidelines/agent-guidelines.md`: Updated command reference table to include `--desc` example
