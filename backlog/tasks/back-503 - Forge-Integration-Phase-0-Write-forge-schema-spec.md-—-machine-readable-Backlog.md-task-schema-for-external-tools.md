---
id: BACK-503
title: >-
  Forge Integration Phase 0: Write forge-schema-spec.md — machine-readable
  Backlog.md task schema for external tools
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 19:58'
labels:
  - forge-schema
  - forge-integration
  - docs
  - specification
milestone: m-7
dependencies:
  - BACK-495
  - BACK-496
  - BACK-497
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
priority: medium
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 0 of the Forge Integration initiative. External tools (Forgejo renderer, sync daemon, GitHub Actions, other AIs) need a stable, versioned, machine-readable specification of the Backlog.md task file format.

Depends on BACK-495 (reactions), BACK-496 (comments), BACK-497 (forge_refs) — implement those first so this doc reflects the final format.

This ticket produces `backlog/docs/forge-schema-spec.md` covering:

1. **File location convention**: `backlog/tasks/{ID} - {slug}.md`, `backlog/completed/`, `backlog/archive/`
2. **Complete YAML frontmatter schema** with all fields, types, optionality, and examples
3. **Body section specification**: headings, case-insensitivity, section variants
4. **Acceptance Criteria / DoD checklist format**: `- [ ] #N text`
5. **Comments section format** (from BACK-496)
6. **Reactions field format** (from BACK-495)
7. **Forge refs field format** (from BACK-497)
8. **Config file format** (`backlog/config.yml`): statuses, labels, prefixes, DoD defaults
9. **Milestone file format**
10. **Schema version field recommendation**

The spec should be in a format that a Go or Python parser can implement without reading Backlog.md TypeScript source code.

**Deliverable:** A new Backlog.md document created via `backlog document create`. This is a docs task, no code changes required.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document `forge-schema-spec.md` exists in backlog/docs/
- [ ] #2 Covers all frontmatter fields with type, optionality, format constraints, and examples
- [ ] #3 Covers all body sections with heading variants and content format
- [ ] #4 Covers reactions, comments, and forge_refs formats (consistent with BACK-495/496/497)
- [ ] #5 Covers config.yml and milestone file formats
- [ ] #6 Includes a schema version field recommendation
- [ ] #7 A Go developer could implement a parser from this spec alone without reading Backlog.md TypeScript source
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
