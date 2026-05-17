---
id: BACK-310
title: Strengthen Backlog workflow overview emphasis on reading detailed guides
status: To Do
assignee:
  - '@codex'
created_date: '2025-10-27 21:37'
updated_date: '2026-05-17 20:27'
labels: []
milestone: m-11
dependencies: []
references:
  - BACK-349
  - BACK-200
priority: low
ordinal: 164000
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
- [ ] #1 The workflow overview document highlights (via formatting or callout) that contributors must read the detailed task guides before proceeding.
- [ ] #2 The updated language adds a brief explanation of why reviewing the detailed guides is required.
- [ ] #3 No conflicting or redundant instructions remain after the update.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Guidance-space relationships: BACK-349 (Publish as Agent Skill) intends the Agent Skill to become the canonical guidance source. If BACK-349 ships, this ticket's scope should narrow to keeping the MCP workflow overview resource in sync with the skill rather than improving it as a standalone document. BACK-200 (Claude Code init) is also in this space for IDE-specific guidance injection.
<!-- SECTION:NOTES:END -->
