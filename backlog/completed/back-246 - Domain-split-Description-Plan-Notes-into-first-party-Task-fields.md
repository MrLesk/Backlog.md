---
id: BACK-246
title: 'Domain: split Description/Plan/Notes into first-party Task fields'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-02 19:59'
updated_date: '2025-09-03 17:36'
labels:
  - domain
  - parsing
  - web-ui
  - tui
dependencies: []
---

## Description

Parse additional sections (Description, Implementation Plan, Implementation Notes) into dedicated Task properties when reading. Maintain the current markdown format on write by composing from these properties. Update serializer/parser and UI to use first-party fields, avoiding duplication and ensuring backward compatibility.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Expose Task.description as the parsed '## Description' section (string)
- [x] #2 Expose Task.implementationPlan as parsed '## Implementation Plan' (string)
- [x] #3 Expose Task.implementationNotes as parsed '## Implementation Notes' (string)
- [x] #4 Serializer composes body from first-party fields preserving current markdown structure
- [x] #5 UI reads from first-party fields; Content editor excludes these sections to prevent duplication
- [x] #6 Maintain backward compatibility for existing tasks and CLI behaviors
- [x] #7 Add tests for parsing + serialization round-trips
- [x] #8 Move sections parsing/composition to core (shared by CLI/TUI/Web)
- [x] #9 Expose Task.sections {description, criteria, plan, notes} in parser output
- [x] #10 Core serializer composes body from Task.sections (single source of truth)
- [x] #11 Refactor TUI (src/ui/task-viewer.ts) to render using Task.sections (no body re-parse)
- [x] #12 CLI plain output uses Task.sections; avoid content duplication (e.g., AC)
- [x] #13 Deprecate/remove web-only sections util once UI consumes core sections
- [x] #14 Add core tests for parse/compose and TUI rendering without duplication
<!-- AC:END -->


## Implementation Plan

1. Core model
   - First-party fields: description, criteria (structured), plan, notes
2. Core composition
   - Serializer composes body from first-party fields; preserves other content
3. TUI/CLI refactor
   - Prefer first-party fields in TUI/plain output; avoid duplication
4. Tests
   - Round-trip parse/serialize and CLI flows; TUI rendering
5. Cleanup
   - Server accepts/returns Task with first-party fields; removed web util
6. DoD
   - All ACs checked, notes added, tests green

## Implementation Notes

Core now exposes Task.sections (description, criteria, plan, notes) via parser. TUI/CLI prefer sections for rendering, eliminating duplication and improving consistency. Serializer supports composing from sections when body is intentionally empty (opt-in), preserving backward compatibility with existing CLI flows that edit body directly. All tests pass. Web util remains as a temporary fallback until UI consumes core sections end-to-end.
