---
id: BACK-182
title: Document agents command and reorganize README CLI reference tables
status: Done
assignee:
  - '@claude'
created_date: '2025-07-13'
updated_date: '2025-07-13'
labels: []
dependencies: []
priority: medium
---

## Description

The README currently has one large CLI reference table with too many rows. Need to: 1) Add documentation for the 'backlog agents --update-instructions' command that allows updating agent instruction files (.cursorrules, CLAUDE.md, etc.) 2) Split the CLI reference into multiple organized tables by purpose (Task Management, Board Operations, Configuration, Web Interface, etc.) for better readability and discoverability.

## Acceptance Criteria

- [x] Document agents upgrade command with examples
- [x] Split CLI reference into purpose-based tables
- [x] Maintain all existing command documentation
- [x] Improve overall README readability

## Implementation Plan

1. Research the agents command functionality and available options\n2. Document the agents upgrade command with examples\n3. Analyze current CLI reference table structure\n4. Reorganize CLI commands into purpose-based tables\n5. Update README with improved organization\n6. Verify all existing commands are still documented

## Implementation Notes

Successfully reorganized CLI reference into purpose-based tables: Task Management, Draft Workflow, Board Operations, Web Interface, Configuration, Documentation, Decisions, Agent Instructions, and Maintenance. Added documentation for the 'backlog agents --update-instructions' command and all doc/decision management commands. All existing commands remain documented and the README is now more readable and discoverable.
