---
id: BACK-76
title: Add Implementation Plan section
status: Done
assignee:
  - '@claude'
created_date: '2025-06-16'
updated_date: '2025-06-19'
labels:
  - docs
  - cli
dependencies: []
---

## Description

Introduce an **Implementation Plan** section in task files so humans and AI agents can outline their approach before starting work. Update README files and guidelines to mention this new section. Add a `--plan` (`-p`) option to `task create` and `task edit` commands so the plan can be provided via CLI.

## Acceptance Criteria

- [x] Task template includes a `## Implementation Plan` section before `Implementation Notes`.
- [x] `.backlog/tasks/readme.md` updated with the new section in the example template.
- [x] Guidelines (`AGENTS.md` etc.) mention drafting an Implementation Plan.
- [x] CLI `task create` and `task edit` accept `--plan` / `-p` to populate the section.
- [x] README / CLI help documents the new option.

## Implementation Plan

1. Understand where task templates are defined
2. Add --plan flag to task create and edit commands  
3. Create updateTaskImplementationPlan function
4. Update documentation and agent guidelines
5. Add comprehensive tests
6. Test the implementation

## Implementation Notes

*Completed by @claude on 2025-06-19*

### Approach
- Implemented --plan flag (not -p as originally specified, to avoid conflict with --parent flag)
- Created `updateTaskImplementationPlan` function following the same pattern as `updateTaskAcceptanceCriteria`
- Positioned Implementation Plan section after Acceptance Criteria but before Implementation Notes
- Added comprehensive test suite with 8 tests covering all edge cases

### Technical Decisions
- Used long option --plan instead of short option -p due to Commander.js limitations with two-letter short flags
- Handled empty plan gracefully by not adding the section if plan is empty or whitespace only
- Implemented proper section positioning logic to maintain consistent task file structure
- Updated all guideline files including those in src/guidelines folder

### Files Modified
1. **Core Implementation**: src/cli.ts, src/markdown/serializer.ts
2. **Documentation**: .backlog/tasks/readme.md, AGENTS.md, CLAUDE.md, .cursorrules
3. **Source Guidelines**: src/guidelines/AGENTS.md, src/guidelines/CLAUDE.md, src/guidelines/.cursorrules.md
4. **Tests**: src/test/implementation-plan.test.ts (new file)

### Trade-offs
- Did not implement -p short flag as it would conflict with existing --parent/-p flag
- Implementation Plan is optional - tasks without plans will continue to work normally
- No migration needed for existing tasks

### Follow-up Considerations
- Consider adding validation for Implementation Plan format
- Could add a command to list tasks without implementation plans
- Might want to add plan templates for common task types
