---
id: BACK-555
title: Add a context-independent handoff check to task creation guidance
status: To Do
assignee: []
created_date: '2026-07-27 21:20'
labels: []
dependencies: []
documentation:
  - MANIFESTO.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/mcp/task-creation.md
priority: medium
type: enhancement
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md already tells agents to write tasks for future workers who have no memory of the originating conversation, but that principle is easy to satisfy superficially. Tasks can still depend on unexplained project terms, libraries, relative references such as “the existing parser,” or dependency IDs that do not name the artifact being consumed.

Make context independence an explicit, operational check in the task-creation workflow. Before reporting a task as created, the creator should read the saved task as a stranger, correct missing context, and confirm the handoff check in the response to the user. Project-specific tools and decisions must be defined or linked; for example, “use Comark” is insufficient unless the task explains what Comark is, why it is required, and where its authoritative documentation lives.

This work changes task-creation guidance and its user-facing creation report. It must not add automated semantic scoring, block task creation, or require speculative implementation research at creation time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The canonical CLI task-creation guide contains a concrete context-independent checklist covering the product or subsystem, desired outcome and why it matters, required inputs and named dependency outputs, expected deliverable, project-specific terms and tools, fixed constraints and authoritative references, scope boundaries, and independently testable acceptance criteria.
- [ ] #2 The guide warns against unanchored references such as “same,” “existing,” “above,” “first,” “current,” and “supported,” and shows how to replace them with explicit identifiers, paths, artifacts, or definitions.
- [ ] #3 The guide states that an unfamiliar library or internal term must be defined by purpose and capability and linked when authoritative documentation is needed; it includes a concrete bad/good example such as the difference between “parse with Comark” and a self-contained Comark requirement.
- [ ] #4 After creating a task, the workflow requires the creator to run `backlog task view <task-id> --plain`, cold-read the saved task without relying on conversation memory, and correct it before handoff when context is missing.
- [ ] #5 The creation report shown to the user includes a concise handoff confirmation that the task was reviewed for readers unfamiliar with the conversation, including defined or linked terms, named dependency outputs, explicit scope, and independently testable acceptance criteria.
- [ ] #6 Every shipped task-creation instruction surface carries equivalent guidance, with the CLI instructions remaining canonical and the legacy MCP guide kept consistent.
- [ ] #7 Automated coverage detects removal or material drift of the context-independent checklist and post-creation handoff requirement from the shipped instruction surfaces.
- [ ] #8 Task creation remains non-blocking: no semantic scoring, task-content validator, or new required task metadata is introduced.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
