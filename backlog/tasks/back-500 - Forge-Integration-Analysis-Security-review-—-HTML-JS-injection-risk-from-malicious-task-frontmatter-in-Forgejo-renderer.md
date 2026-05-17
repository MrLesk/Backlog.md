---
id: BACK-500
title: >-
  Forge Integration Analysis: Security review — HTML/JS injection risk from
  malicious task frontmatter in Forgejo renderer
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 19:58'
labels:
  - forge-integration
  - forgejo
  - analysis
  - security
  - research
milestone: m-7
dependencies: []
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
  - /home/jo/kit/forgejo/modules/markup/sanitizer.go
priority: high
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Security analysis for Forge Integration Phase 1 (Forgejo file renderer). When a custom `markup.Renderer` parses YAML frontmatter from `backlog/tasks/*.md` and generates HTML for display in the Forgejo file browser, malicious task files could attempt XSS or HTML injection.

**Attack surface:**
- Task title: `&lt;script&gt;alert(1)&lt;/script&gt;` in `title:` frontmatter
- Task description: markdown body with JavaScript links, `javascript:` URLs, HTML tags
- Label names, assignee names, milestone names containing HTML
- URL fields (`references:`, `documentation:`) with `javascript:` or `data:` URLs
- The HTML comment delimiters in `## Comments` section — can they be escaped to break the parser?

**Research questions:**
1. Does Forgejo's `modules/markup/sanitizer.go` apply to output from custom Renderer implementations?
2. Is the sanitizer applied automatically to all `Render()` output, or must the renderer opt in?
3. What is the `SanitizerRules()` method in the Renderer interface for — is it called automatically?
4. What existing renderers (CSV, OrgMode) do for sanitization — do they rely on the framework or do it themselves?

**Files to examine:**
- `modules/markup/sanitizer.go`
- `modules/markup/renderer.go` — how SanitizerRules() is used
- `modules/markup/csv/csv.go` — example of a simple renderer

**Deliverable:** Security assessment in Implementation Notes: (a) whether sanitizer applies automatically, (b) attack vectors that remain, (c) required mitigations before shipping the renderer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sanitizer applicability to custom renderers is determined definitively (yes/no/partial)
- [ ] #2 All identified XSS attack vectors are documented
- [ ] #3 Mitigations specified for each attack vector
- [ ] #4 Go-level escaping approach recommended (e.g., html.EscapeString, template.HTMLEscapeString)
- [ ] #5 Verdict: is the renderer safe to ship with standard Forgejo sanitization, or does it need additional hardening?
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
