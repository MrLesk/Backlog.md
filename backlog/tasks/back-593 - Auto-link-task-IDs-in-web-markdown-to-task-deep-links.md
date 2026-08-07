---
id: BACK-593
title: Auto-link task IDs in web markdown to task deep links
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 21:10'
updated_date: '2026-08-07 21:23'
labels:
  - web
dependencies: []
priority: medium
type: enhancement
ordinal: 233000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task IDs mentioned in prose (descriptions, plans, implementation notes, comments, final summaries, documents, decisions) render as plain text in the Web UI, so following a reference means copying the ID and searching for it.

This task takes over community PR #812 by @cottrell (https://github.com/MrLesk/Backlog.md/pull/812), which added the feature: bare task IDs in markdown become links to /tasks/<id>, and dependency chips in the task details sidebar become clickable links. The fork PR is stale (base ~100 commits behind), its own Backlog task ID collides with an existing BACK-555 on main, and review found two defects that must be fixed before this can ship:

1. Over-broad detection. The matcher used a generic letters-dash-digits pattern with no check against real tasks, so it linkified UTF-8, ISO-8601, version strings, and the tail of longer identifiers (my-task-123 linked task-123). Detection must be constrained to real task identity, and a leading boundary must prevent partial matches inside longer identifiers.
2. Code blocks were not excluded. The guard counted backticks on the current line only, so fenced code blocks were still linkified even though the PR claimed to exclude them. Inline code and fenced blocks must both be reliably excluded.

Related: BACK-239 covers the same idea for documents and decisions plus backlinks; this task is the task-ID half only and should leave a mechanism BACK-239 can extend.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare task IDs that match a known task render as links to /tasks/<id> in web markdown fields (description, plan, notes, comments, final summary, documents, decisions)
- [x] #2 Task IDs inside inline code spans and fenced code blocks are not linkified
- [x] #3 Non-task tokens such as UTF-8, ISO-8601 and v1.2.3, and longer identifiers whose tail looks like a task ID such as my-task-123, are not linkified
- [x] #4 Task IDs inside existing markdown links keep their original link target
- [x] #5 Dependency chips in the task details sidebar link to the referenced task
- [x] #6 Web component tests cover linking, code-block exclusion, non-task tokens, and dependency chip links
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Take over PR #812 by cherry-picking cottrell's two source commits (MermaidMarkdown auto-link, DependencyInput chip links) onto a branch off current main, excluding his colliding back-555 task file.
2. Move detection from string-level regex over raw markdown to the markdown AST: add a small remark plugin (src/web/utils/task-id-links.ts) that walks mdast text nodes and rewrites task-ID matches into link nodes. Code fences and inline code carry no text children, so they are excluded structurally; link/linkReference subtrees are skipped so existing links keep their target.
3. Validate candidates against the task corpus the web UI already loads: build a canonical-ID index (canonicalTaskId from src/utils/task-id.ts) in a small TaskIdIndexProvider fed by App state, consumed by MermaidMarkdown. Unknown tokens (UTF-8, ISO-8601, v1.2.3) never link, and no new API call is added.
4. Add leading/trailing boundary rules so IDs embedded in longer identifiers (my-task-123, BACK-1.md) are not matched.
5. Keep dependency chips as react-router links, but only when the referenced task exists in the loaded corpus.
6. Extend src/test/mermaid-markdown.test.tsx and add a DependencyInput test; run tsc, biome, and the full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Takeover of PR #812 by David Cottrell (@cottrell). His two source commits were cherry-picked with authorship preserved (`git cherry-pick -x`), so the original work is in the branch history:
- b834302d "Auto-link task IDs in markdown fields to deep links" (MermaidMarkdown + first two tests)
- c56de5d9 "Make dependencies chips clickable deep links to /tasks/:id" (DependencyInput)
His `back-555` task file and the plan/finalize commits were excluded: that ID already belongs to a different task on main.

What survived from the original: the feature idea and its shape (bare IDs become `/tasks/<id>` links, dependency chips become router links), the DependencyInput chip Link, and the two original test cases (kept, with stronger assertions).

What was rewritten and why:
1. Detection moved from a string rewrite of the raw markdown to a small remark plugin over the mdast (`src/web/utils/task-id-links.ts`). The original counted backticks on the current line, so ``` fenced blocks were still linkified, contradicting the PR own acceptance criterion. In the AST, `code` and `inlineCode` nodes carry no text children, so both forms of code are excluded by construction rather than by guesswork, and `link`/`linkReference` subtrees are skipped so existing links keep their target.
2. Candidates are now validated against real tasks. `TaskIdIndexProvider` (src/web/contexts/TaskIdIndexContext.tsx) builds a canonical-ID index from the task corpus App already loads and passes to the modal, so no new API call and no extra fetch; `canonicalTaskId` from src/utils/task-id.ts makes `back-123`, `BACK-0123` and `BACK-123` resolve to the same task and the link always uses the canonical ID. Unknown ID-shaped tokens (UTF-8, ISO-8601, BACK-9999) never link.
3. Boundary rules replace `\b`: a candidate preceded by [A-Za-z0-9_-/.] or followed by an identifier character or a file extension is rejected, so `my-task-123`, `backlog/tasks/TASK-123` and `BACK-1.md` stay plain.
4. Dependency chips link only when the referenced task is in the loaded corpus; unknown dependencies stay plain text instead of pointing at a route that cannot resolve.

Tradeoffs recorded for review:
- Auto-links render as plain anchors, like hand-written markdown links in this component, so following one is a full page load rather than a client-side route change. Chips keep client-side navigation. Making markdown links client-side would require a Router in MermaidMarkdown and its tests; not worth it for a localhost UI.
- When the task corpus is empty (initial load, or MermaidMarkdown rendered outside the provider) nothing is linkified. Failing closed was preferred over emitting links that may not resolve.
- The provider wrapper in App.tsx was added without re-indenting the 120-line JSX block it wraps, to keep the diff reviewable.

Verification:
- bunx tsc --noEmit and bun run check . clean.
- bun test src/test/mermaid-markdown.test.tsx (12 pass) and src/test/web-dependency-input-links.test.tsx (2 pass).
- Live check against this repo through `backlog browser`: task BACK-593 description rendered BACK-555/BACK-239/back-555 as /tasks/ links while UTF-8, ISO-8601, v1.2.3 and my-task-123 stayed plain; a scratch document confirmed a fenced block and an inline code span containing BACK-239 were not linkified while the same ID in prose was; clicking an auto-link opened the target task, and the BACK-544 dependency chip navigated to BACK-543.

Full verification run: bun run test -> 1955 pass, 5 skip, 0 fail across 215 files; bunx tsc --noEmit clean; bun run check . clean; bun run build produced dist/backlog.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Took over PR #812 (David Cottrell, @cottrell): task IDs written in prose in the Web UI now render as links to /tasks/<id>, and dependency chips in the task details sidebar link to the task they reference. His two source commits were cherry-picked so his authorship stays in the history; the colliding back-555 task file was dropped.

Both defects found in review are fixed. Detection now runs as a small remark plugin over the markdown AST (src/web/utils/task-id-links.ts) instead of a regex over the raw source, so inline code and fenced code blocks are excluded structurally and existing links keep their target. Candidates are validated against the task corpus the Web UI already loads, through a TaskIdIndexProvider fed by App state, so UTF-8, ISO-8601, v1.2.3 and unknown IDs never link, and boundary rules keep ID-shaped tails of longer identifiers (my-task-123, backlog/tasks/TASK-123, BACK-1.md) plain.

Verified with 12 tests in src/test/mermaid-markdown.test.tsx and 2 in src/test/web-dependency-input-links.test.tsx, the full suite (1955 pass, 0 fail), tsc and biome clean, plus a live browser check against this repo: prose IDs linked, a fenced block and an inline code span with the same ID stayed plain, clicking an auto-link opened the target task, and a dependency chip navigated from BACK-544 to BACK-543.
<!-- SECTION:FINAL_SUMMARY:END -->
