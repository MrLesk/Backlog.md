---
id: BACK-504
title: >-
  Forge Integration Phase 1: Implement Forgejo markup.Renderer for
  backlog/tasks/*.md (task card HTML display in file browser)
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 20:27'
labels:
  - forge-integration
  - forgejo
  - go
  - renderer
  - phase-1
milestone: m-7
dependencies:
  - BACK-500
  - BACK-503
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
  - /home/jo/kit/forgejo/modules/markup/renderer.go
  - /home/jo/kit/forgejo/modules/markup/csv/csv.go
priority: medium
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 1 of the Forge Integration initiative. Implement a custom `markup.Renderer` in Forgejo that renders `backlog/tasks/*.md` files as rich HTML task cards in the file browser, instead of raw markdown.

Depends on BACK-500 (security review) — must pass before shipping.

**How the Forgejo renderer system works:**
- `modules/markup/renderer.go` defines `Renderer` interface: `Name()`, `Extensions()`, `SanitizerRules()`, `Render(ctx, input, output)`
- `RegisterRenderer(r)` adds to global registry, called from `init()`
- `renderFile()` in `routers/web/repo/view.go:379` calls `markup.Type(blob.Name())` → renders if registered
- Detection can be path-based via `RendererContentDetector` interface: `CanRender(ctx)`

**Implementation location:** `modules/markup/backlogmd/backlogmd.go` (new package in `/home/jo/kit/forgejo/`)

**The renderer should:**
1. Detect files via `CanRender(ctx)` — check if path matches `backlog/tasks/*.md` prefix
2. Parse YAML frontmatter from the input stream (use `gopkg.in/yaml.v3`)
3. Render HTML task card with:
   - Status badge (colored: To Do=grey, In Progress=blue, Done=green)
   - Priority badge (high=red, medium=orange, low=grey)
   - Title as `<h1>`
   - Labels as pill badges
   - Assignees, milestone, dependencies as metadata sidebar
   - Description rendered as markdown (reuse goldmark)
   - Acceptance Criteria as checklist with ✅/⬜ icons
   - Definition of Done as checklist
4. Apply `html.EscapeString` to all user-supplied values (per BACK-500 guidance)
5. Register via `init()` in the package, imported in main Forgejo startup

**This is a Forgejo-side ticket. Work in `/home/jo/kit/forgejo/`.**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New Go package `modules/markup/backlogmd/` in Forgejo with `Renderer` implementing `markup.Renderer` + `markup.RendererContentDetector`
- [ ] #2 Files under `backlog/tasks/` are detected and rendered as task cards; other `.md` files render normally
- [ ] #3 Task card HTML shows: status badge, priority badge, title, labels, assignees, milestone, description (markdown), acceptance criteria checklist
- [ ] #4 All user-supplied strings are HTML-escaped
- [ ] #5 Renderer is registered in Forgejo app startup (imported somewhere in `cmd/` or `routers/`)
- [ ] #6 Manual test: `make run` in Forgejo dev, browse to a `backlog/tasks/*.md` file → task card appears
- [ ] #7 Security review (BACK-500) passed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
