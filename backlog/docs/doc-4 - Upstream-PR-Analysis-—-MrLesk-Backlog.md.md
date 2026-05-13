---
id: doc-4
title: Upstream PR Analysis — MrLesk/Backlog.md
type: other
created_date: '2026-05-13 10:48'
tags:
  - upstream
  - triage
  - analysis
---
# Upstream PR Analysis — MrLesk/Backlog.md

## Context

The user wants a triage of all open PRs on the upstream repo (`MrLesk/Backlog.md`) that are **not** from `@lenucksi` (those are our own). Goal: assess how much work each PR still needs, and identify which are valuable enough to cherry-pick into our local `main` now rather than waiting for upstream to merge.

Upstream repo: `https://github.com/MrLesk/Backlog.md`  
Our own open PRs (excluded): #635, #637, #638, #639 (all `CHANGES_REQUESTED` by MrLesk)

---

## PR Triage

### 🟢 Low effort / near-ready — strong candidates for cherry-pick

#### #644 — `fix: sort milestones ascending by ID in browser UI` (raincrossgazette)
- **Size**: +10/-10, 1 file (`MilestonesPage.tsx`)
- **CI**: n/a (no checks triggered — branch is clean)
- **Merge**: MERGEABLE, no review
- **What it does**: Fixes milestones sorting descending (newest first) to ascending (oldest first), which matches natural sprint/phase order. The old comment in code literally said "IDs are sequential m-0, m-1" but sorted backwards.
- **Work needed**: None. Diff is trivially correct.
- **Recommendation**: **Cherry-pick immediately.** Tiny, obviously correct fix.

#### #645 — `feat: add ordinal as a sortable column in the list view` (raincrossgazette)
- **Size**: +28/-11, 2 files (`cli.ts`, `TaskList.tsx`)
- **CI**: n/a
- **Merge**: MERGEABLE, no review
- **What it does**: Adds `ordinal` as a valid `--sort` field in the CLI and as a sortable column in the web list view. Board view already respects ordinal; this makes list view consistent.
- **Work needed**: None. Clean, focused diff, handles null ordinals correctly (tasks with ordinals sort before those without).
- **Recommendation**: **Cherry-pick.** Low risk, completes an obvious gap.

---

### 🟡 Medium effort / blocked by review feedback

#### #632 — `BACK-465 - Detect and warn about duplicate task IDs` (brooksc)
- **Size**: +311/-10, 11 files
- **CI**: **FAILING** on macOS and Windows (unit tests pass on Linux). 2 comments on PR.
- **Merge**: MERGEABLE, no review decision
- **What it does**: Adds `detectDuplicateTaskIds()` utility, amber warning banner in web UI, "Copy AI fix prompt" button, and duplicate detection in MCP `task_list`. Solves a real problem when two branches create the same task ID and get merged.
- **Work needed**: Fix the macOS/Windows CI failures (likely path separator or filesystem case-sensitivity issue). Also needs a maintainer review pass.
- **Recommendation**: **Worth tracking.** The feature is genuinely useful. Before cherry-picking, need to understand why macOS/Windows tests fail — could be trivial (path sep) or structural. Do not cherry-pick until CI is green.

#### #634 — `BACK-467 - Add local file preview with syntax highlighting` (kuwork)
- **Size**: +507/-13, 8 files
- **CI**: ALL PASSING ✓
- **Merge**: MERGEABLE, **CHANGES_REQUESTED** by MrLesk
- **What it does**: Clickable local file paths in task references/docs open a modal with Prism syntax highlighting + line numbers, supports partial ranges like `src/foo.ts:35-39`.
- **Review feedback (MrLesk)**:
  1. Path parsing logic should not live in `src/server/index.ts` — extract to a tested core/filesystem API
  2. **Security bug**: `targetPath.startsWith(rootDir)` is an unsafe traversal check — a sibling directory with the same prefix passes. MrLesk confirmed he reproduced `../project-secret/secret.txt` being served.
- **Work needed**: Medium. Refactor handler + fix the path containment check (use `path.resolve` + check that result starts with normalized `rootDir + path.sep`). Approximately 1–2h of focused work.
- **Recommendation**: **Valuable feature, but do not cherry-pick with the security bug.** If we want this sooner, we'd need to apply the fix ourselves.

---

### 🔴 Large / needs significant rework or waiting

#### #646 — `BACK-208 - Add paste-as-markdown support in Web UI` (kuwork)
- **Size**: +2050/-42, 21 files
- **CI**: ALL PASSING ✓
- **Merge**: MERGEABLE, no reviews/comments
- **What it does**: Intercepts paste events in the web editor, detects rich-text HTML (from Word, Google Docs, web pages), strips junk, converts to Markdown via Turndown+GFM. Also handles pasted images (screenshots → temp assets).
- **Work needed**: Needs a proper review — adds a new dependency (`turndown`), changes the editor component significantly. CI is green but no human review has happened. Medium effort to review properly.
- **Recommendation**: **Potentially cherry-pickable after review.** Feature is genuinely useful. But it's 2k lines and untested by a human reviewer.

#### #647 — `BACK-473/474 - Wiki web UI with file tree navigation + wiki install command` (kuwork)
- **Size**: +5465/-44, 38 files
- **CI**: unknown (no checks shown)
- **Merge**: MERGEABLE, no reviews
- **What it does**: Adds an entire Wiki section to the web UI — file tree sidebar, markdown rendering, frontmatter parsing, new API endpoints (`/api/wiki/tree`, `/api/wiki/*`), `wiki install` CLI command.
- **Work needed**: Large. Needs full review, security audit of the file-serving endpoints (same path traversal risk class as #634), integration testing, and alignment with the project's scope decisions.
- **Recommendation**: **Do not cherry-pick now.** Big feature, zero review. Wait for upstream decision.

#### #648 — `BACK-475 - Add Word (.docx) upload for image extraction` (kuwork)
- **Size**: +5974/-49, 41 files
- **CI**: unknown
- **Merge**: MERGEABLE, no reviews
- **What it does**: Backend `docx-converter.ts` using `mammoth` to extract text + images from `.docx` uploads. Extends #646 (paste-as-markdown) to handle the case where clipboard doesn't expose images.
- **Work needed**: Depends on #646 being merged first. Adds a significant new dependency (`mammoth`). Large surface area. Needs full review.
- **Recommendation**: **Block on #646.** Do not cherry-pick standalone.

#### #633 — `Feature: Add Decision Management CLI commands and MCP Tools` (abbyssoul)
- **Size**: +1144/-139, 32 files
- **CI**: unknown
- **Merge**: MERGEABLE, no reviews/comments
- **What it does**: First-class ADR (Architectural Decision Records) support — CLI commands (`decision list`, `decision view`), MCP tools, new `decisions/` content type, parser/serializer changes, web component `DecisionDetail.tsx`.
- **Work needed**: Substantial review needed. Touches parser, serializer, types, MCP schema, CLI, web — all core surfaces. Zero reviews. Could conflict with our own open PRs (especially #635 which touches core status/statistics logic).
- **Recommendation**: **Interesting but risky to cherry-pick.** Potential conflicts with our own work. Wait for upstream alignment.

---

### ⛔ Stale / conflicting — skip

#### #550 — `back-399 - Add configurable tasksDirectory` (maeste, Feb 2026)
- **Merge**: **CONFLICTING** (merge conflicts)
- MrLesk already commented: lacks compatibility with multi-branch sync. Alex's agent marked it not merge-ready.
- **Recommendation**: Skip. Stale, conflicting, design issues. Would need full rework on a new task ID.

#### #361 — `TASK-270 - Prevent command substitution in task creation inputs` (MrLesk, Sep 2025!)
- **Merge**: **CONFLICTING** (merge conflicts)
- MrLesk's own 8-month-old PR. Likely superseded or abandoned.
- **Recommendation**: Skip entirely.

---

## Summary Table

| PR   | Author           | Size    | CI      | Review         | Cherry-pick?         |
|------|-----------------|---------|---------|----------------|----------------------|
| #644 | raincrossgazette | tiny    | n/a     | none           | ✅ Yes, immediately  |
| #645 | raincrossgazette | tiny    | n/a     | none           | ✅ Yes, immediately  |
| #632 | brooksc          | medium  | ❌ FAIL | none           | 🟡 After CI fix      |
| #634 | kuwork           | medium  | ✅ PASS | CHANGES_REQ    | 🟡 After security fix|
| #646 | kuwork           | large   | ✅ PASS | none           | 🟡 After review      |
| #647 | kuwork           | xlarge  | ?       | none           | ❌ Wait upstream     |
| #648 | kuwork           | xlarge  | ?       | none           | ❌ Needs #646 first  |
| #633 | abbyssoul        | large   | ?       | none           | ❌ Conflict risk     |
| #550 | maeste           | medium  | ✅ PASS | none (stale)   | ⛔ Skip, conflicts   |
| #361 | MrLesk           | small   | ✅ PASS | none (stale)   | ⛔ Skip, conflicts   |

---

## Recommended Actions

1. **Cherry-pick #644 and #645** into our main — both are trivially correct, zero risk.
2. **Watch #632** — useful feature, but wait until CI passes on macOS/Windows.
3. **Optionally port #634** ourselves with the security fix applied — the feature is useful and CI passes, just needs the path-traversal fix and refactor MrLesk asked for.
4. **Leave #646, #647, #648, #633** for upstream to review and merge — too large to adopt without upstream vetting.
5. **Ignore #550 and #361** — stale and conflicting.
