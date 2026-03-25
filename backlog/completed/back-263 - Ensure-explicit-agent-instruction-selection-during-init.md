---
id: BACK-263
title: Ensure explicit agent instruction selection during init
status: Done
assignee:
  - '@codex'
created_date: '2025-09-10 06:23'
updated_date: '2025-09-10 20:59'
labels: []
dependencies: []
---

## Description

Add 'Do not add instructions (danger, this will make backlog not usable with ai agents)' option and enforce selection; mention multi-selection; ignore contradictory 'do not add instructions' when other agent instructions selected

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Init prompt includes 'Do not add instructions (danger...)' option in agent file selection
- [x] #2 Interactive: pressing Enter with no selection shows an error 'Please select at least one option (press space to select)' and re-prompts until a choice is made
- [x] #3 Prompt clearly states multiple selections are allowed (space to select, enter to confirm)
- [x] #4 If 'Do not add instructions' and any other options are selected, ignore 'none' and proceed creating the selected agent instruction files
- [x] #5 Flag --agent-instructions accepts: cursor, claude, agents, gemini, copilot, none; 'none' is ignored if combined with other values; invalid values produce a helpful error
- [x] #6 README documents the behavior with examples for interactive and non-interactive modes, including multi-select and the 'none' option
<!-- AC:END -->


## Implementation Plan

1. Review PR 339 and current init flow
2. Update init multiselect: add none option, enforce non-empty selection, improve hint text
3. Handle non-interactive --agent-instructions (support none + validate values)
4. Add tests for none-only, none+others, and invalid values
5. Update README (init section) with examples and guidance
6. Run tests, lint, typecheck; finalize notes and ACs


## Implementation Notes

Implemented init agent instructions selection refinements:
- Added explicit "Do not add instructions" option
- Enforced non-empty selection in interactive flow (error + re-prompt)
- Clarified multi-select hint
- Ignored contradictory "none" when combined with other instructions
- Enhanced --agent-instructions flag (supports none, validation, helpful error)
- Updated README with examples and guidance
- Added tests: none-only, none+others, invalid value

Validation: bunx tsc --noEmit; biome check .; bun test (542 passed)

Follow-up: Switched to prompts built-in validation for the multiselect with `min: 1` + `warn`, removed manual re-prompt loop so the error appears inline (yellow) within the prompt instead of scrolling text.

UI: Updated agent selection titles to include tools; removed .cursorrules (Cursor now uses AGENTS.md); kept alias `cursor` mapping to AGENTS.md; updated help/docs/tests accordingly.
