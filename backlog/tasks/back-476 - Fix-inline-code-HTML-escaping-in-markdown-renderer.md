---
id: BACK-476
title: Fix HTML-entity escaping inside inline code in markdown renderer
status: Done
assignee: 
  - Kimi
created_date: '2026-05-13 23:08'
updated_date: '2026-05-13 23:37'
labels:
  - web-ui
  - bug
  - wiki
  - markdown
dependencies: []
priority: medium
ordinal: 24001
---

# back-476 - Fix HTML-entity escaping inside inline code in markdown renderer

## Description

The `sanitizeMarkdownSource` helper in `MermaidMarkdown.tsx` escapes `<` to `&lt;` to prevent raw HTML-like tags from being parsed by the Markdown renderer. However, it was applying this escape indiscriminately, including inside inline code blocks (e.g. `` `<id>` ``) and fenced code blocks.

Because Markdown renderers already preserve code content verbatim, this caused double encoding: the user saw `&lt;id&gt;` instead of `<id>`.

This component is used across multiple views — wiki pages, task details (description, plan, notes, final summary), documentation, decisions, and file previews — so the bug affected all of them.

## Root Cause

- `source.replace(/<(?=[A-Za-z])/g, ...)` runs over the entire markdown source without excluding code regions.
- Inline code like `` `backlog task <id>` `` becomes `` `backlog task &lt;id>` `` after sanitization.
- The Markdown renderer then outputs `<code>backlog task &lt;id></code>`, and the browser displays the literal `&lt;` entity.

## Fix

Updated `sanitizeMarkdownSource` to first collect protected ranges for:

- Fenced code blocks (```...```)
- Inline code (`...`)

The `<` replacement is now skipped when the match offset falls inside any protected range.

## Implementation Plan

1. Identify all fenced code blocks and inline code spans in the raw markdown source before running the `<` escape replacement.
2. Record the start/end offsets of each protected range.
3. During the existing `replace` pass, check whether the current match offset lies inside any protected range.
4. If inside a code region, return the original `<` unchanged; otherwise apply the existing logic (escape to `&lt;` unless it is a URI/email autolink).

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

**File:** `src/web/components/MermaidMarkdown.tsx`

Added two regex passes before the existing `<` replacement to mark code regions as protected:

1. **Fenced code blocks:** `/```[\s\S]*?```/g`
2. **Inline code:** ``/`[^`\n]+`/g``

During the replacement loop, each match offset is checked against the collected protected ranges. If the offset falls inside a code block or inline code segment, the original `<` is preserved instead of being escaped to `&lt;`.

The existing URI/email autolink exemptions (`<mailto:...>`, `<user@example.com>`) continue to work for matches outside code regions.

<!-- SECTION:NOTES:END -->

## Acceptance Criteria

- [x] Inline code containing `<` renders correctly (e.g. `` `<id>` `` displays as `<id>`, not `&lt;id&gt;`)
- [x] Fenced code blocks containing `<` render correctly
- [x] Regular text outside code still has `<Something>` escaped to prevent accidental HTML tag parsing
- [x] URI autolinks (e.g. `<mailto:...>`) and email autolinks remain unaffected

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes.
- [x] #2 Type-check confirms no new errors in `src/web/components/MermaidMarkdown.tsx`.
- [x] #3 Manual test: inline code like `` `<id>` `` displays `<id>` instead of `&lt;id&gt;` across wiki, task details, documentation, and decision views.
<!-- DOD:END -->
