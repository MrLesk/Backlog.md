---
id: BACK-59
title: Simplify init command with modern CLI
status: Done
assignee:
  - '@codex'
created_date: '2025-06-14'
updated_date: '2025-06-14'
labels:
  - cli
dependencies: []
---

## Description
Simplify the `backlog init` command by removing the TUI wizard and replacing it with a plain CLI questionnaire similar to modern tools like `vue-cli`. The agent instruction file selection should use checkboxes rendered directly in the terminal. Users can navigate with arrow keys, toggle selections with <space>, and press <enter> to confirm. Display a hint explaining these controls.

## Acceptance Criteria
- [x] `backlog init` prompts for project and reporter names using standard text prompts
- [x] Agent selection presents checkboxes and instructions on how to select
- [x] Implementation relies on a lightweight prompt library (e.g. `prompts`)
- [x] No `blessed` TUI is used during init
- [x] Tests and lint pass

## Implementation Notes

The `backlog init` command has been successfully simplified from a blessed-based TUI wizard to a modern CLI questionnaire:

**Key Changes:**
- **Text prompts**: Replaced TUI input fields with standard `promptText()` calls using readline for project name and reporter name collection
- **Agent selection**: Implemented checkbox-based selection using the `prompts` library with `multiselect` type, providing arrow key navigation, space bar toggling, and enter to confirm
- **User experience**: Added helpful hint text ("- Space to select · Enter to confirm") to guide users through the selection process
- **Dependency management**: Leveraged existing `prompts` dependency, avoiding need for additional libraries

**Current Implementation (src/cli.ts:44-122):**
1. Git repository check with y/N prompt for initialization if needed
2. Project name prompt using `promptText()` 
3. Reporter name prompt with optional global storage
4. Agent instruction file selection using `prompts.multiselect()` with checkboxes
5. Backlog initialization and file creation

**Test Coverage:**
All existing CLI integration tests continue to pass, including specific init command tests that verify:
- Project initialization in existing git repos
- Directory structure creation
- Agent instruction file generation
- Git commit automation

The implementation meets all acceptance criteria while maintaining backward compatibility and test coverage.
