---
id: task-5
title: "CLI: Implement Docs & Decisions CLI Commands (Basic)"
status: Done
assignee: []
reporter: @MrLesk
created_date: 2025-06-04
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-3"]
---

## Description

Implement basic CLI commands for managing documentation and decision logs:

- `backlog doc create <title> -p <path>` (to create a new documentation file)
- `backlog doc create <title> --path <path>` (to create a new documentation file)
- `backlog doc create <title>` (to create a new documentation file in the root folder)
- `backlog doc list`
- `backlog decision create <title>`
- `backlog decision list`

## Acceptance Criteria

- [x] Creation and listing commands functional for docs and decisions.
- [x] Files are created in the correct `.backlog/docs/` and `.backlog/decisions/` directories.

## Implementation Notes

All CLI commands for docs and decisions have been successfully implemented:

**Document Commands (src/cli.ts:380-412):**
- `backlog doc create <title>` - Creates docs in `.backlog/docs/` with auto-generated IDs
- `backlog doc create <title> -p <path>` - Creates docs in subdirectories within `.backlog/docs/`  
- `backlog doc list` - Lists all documents with ID and title
- Documents use proper YAML frontmatter with id, title, type, created_date fields

**Decision Commands (src/cli.ts:414-447):**
- `backlog decision create <title>` - Creates decision logs in `.backlog/decisions/`
- `backlog decision create <title> -s <status>` - Creates decisions with custom status (default: "proposed")
- `backlog decision list` - Lists all decisions with ID and title  
- Decisions use structured template with Context, Decision, Consequences sections

**Core Functionality:**
- Auto-incremental ID generation for both docs and decisions
- Proper YAML frontmatter serialization via gray-matter library
- Git auto-commit integration for created files
- File sanitization for cross-platform compatibility
- Comprehensive test coverage in cli.test.ts (lines 862-893)

**File Structure:**
- Documents: `.backlog/docs/{optional-path}/filename.md`
- Decisions: `.backlog/decisions/decision-{id} - {title}.md`
- Both support subdirectories and maintain consistent naming conventions

All tests pass (33/33) confirming full functionality and adherence to acceptance criteria.
