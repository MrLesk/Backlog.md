---
id: doc-5
title: Forge Integration Feasibility Study — Backlog.md ↔ Forgejo/GitHub/GitLab
type: specification
created_date: '2026-05-17 19:50'
tags:
  - forge
  - forgejo
  - github
  - integration
  - feasibility
  - architecture
---
# Forge Integration Feasibility Study
## Backlog.md ↔ Forgejo / GitHub / GitLab

**Date:** 2026-05-17  
**Status:** Analysis Complete  
**Author:** Claude Sonnet 4.6 (commissioned by @lenucksi)

---

## Executive Summary

Backlog.md stores project tasks as markdown files in-repo. Forges (Forgejo, GitHub, GitLab) have their own database-backed issue trackers. Both live in the same project, creating **double-reality**: two issue systems, neither aware of the other.

**The Vision:** Make forges — starting with Forgejo — read Backlog.md `.md` task files from git and surface them natively in the forge issue UI. Bidirectional transport via git commits (not DB→API sync). Cross-forge propagation = git push/pull. Pure markdown remains the source of truth.

**Recommendation:** Phased approach — start with a Forgejo custom file renderer (1-2 weeks, zero risk), stabilize the Backlog.md schema for forge-readability (2 weeks), then build the full BacklogSource unit (6-8 weeks).

**Total range:** 1 day (ExternalTracker redirect only) to 20 weeks (full native integration with write-back).

---

## 1. Codebase Analysis

### 1.1 Backlog.md Data Model

Tasks are stored as markdown files: `backlog/tasks/BACK-123 - Some-Title.md`

**Complete frontmatter schema (YAML):**
```yaml
id: BACK-123
title: Task title
status: To Do              # configurable from config.yml statuses[]
priority: high|medium|low
ordinal: 12345             # manual sort order (lower = first)
assignee: ["@username"]
reporter: "@username"
created_date: 2026-05-17 10:00
updated_date: 2026-05-17 15:30
labels: ["enhancement", "web-ui"]
milestone: "v2.0"
dependencies: ["BACK-100", "BACK-101"]
references: ["https://..."]
documentation: ["https://..."]
modified_files: ["src/foo.ts"]
parent_task_id: "BACK-120"
subtasks: ["BACK-123.1", "BACK-123.2"]
onStatusChange: "echo $TASK_ID moved to $NEW_STATUS"
```

**Body sections:**
- `## Description` — narrative explanation
- `## Acceptance Criteria` — `- [ ] #1 text` checklists
- `## Definition of Done` — completion checklist
- `## Implementation Plan` — step-by-step approach
- `## Implementation Notes` — progress notes (no timestamp, no author attribution)
- `## Final Summary` — completion report

**Architecture (TypeScript/Bun):**
- `src/core/backlog.ts` — main CRUD (92KB)
- `src/markdown/parser.ts` + `serializer.ts` — parse/write task files
- `src/types/index.ts` — TypeScript interface definitions
- `src/mcp/` — MCP server exposing task_create/edit/view/list/search
- `src/web/` — React SPA + REST API
- `src/commands/` — CLI commands
- `src/ui/` — TUI (blessed)

### 1.2 Forgejo Issue System Architecture

**Database model** (Go/xorm ORM, PostgreSQL/MySQL/SQLite):

The `Issue` struct contains:
- `ID`, `RepoID` (unique index with issue number), `Title`, `Content` (LONGTEXT), `RenderedContent`
- `Labels`, `MilestoneID`, `Priority` (Forgejo-specific!), `AssigneeID`, `Assignees` (multi)
- `Reactions`, `Comments`, `Attachments`, `IsClosed`, `IsPull`, `PinOrder`
- `DeadlineUnix`, `CreatedUnix`, `UpdatedUnix`, `ContentVersion`

The `Comment` struct has **39+ CommentTypes**: regular comments, reopen, close, label-change, milestone-change, assignment-change, code-review threads, time-tracking, dependency add/remove, title changes, pin/unpin, etc.

The `Reaction` struct: `Type` (emoji string), `IssueID`, `CommentID`, `UserID`, `CreatedUnix`.

**ExternalTracker** (critical existing feature):
- `models/unit/unit.go`: `TypeExternalTracker` unit type exists alongside `TypeIssues`
- `ExternalTrackerConfig`: `ExternalTrackerURL`, `ExternalTrackerFormat` (`{user}/{repo}/{issue}`), `ExternalTrackerStyle` (numeric/alphanumeric/regexp), `ExternalTrackerRegexpPattern`
- **`TypeIssues` and `TypeExternalTracker` are mutually exclusive** — enforced in `models/unit/unit.go:242`
- ExternalTracker only redirects issue links — does NOT display content inline

**Renderer plugin system** (key extension point):
- `modules/markup/renderer.go`: `Renderer` interface with `Name()`, `Extensions()`, `SanitizerRules()`, `Render()`
- `RegisterRenderer(r Renderer)` — global registry, each renderer calls this from `init()`
- Existing renderers: Markdown, OrgMode, CSV, AsciiCast, Console, external command
- `renderFile()` in `routers/web/repo/view.go:379` calls `markup.Type(blob.Name())` → renders if registered

**Projects/Kanban** (already exists):
- `models/project/` with `project_board` (columns) and `project_issue` (issue-column assignments)
- Forgejo issues can be assigned to Kanban columns in Projects

---

## 2. Gap Analysis: Backlog.md vs. Forge Issues

| Feature | Backlog.md | GitHub/Forgejo |
|---------|-----------|----------------|
| Title | ✅ | ✅ |
| Body/Description | ✅ | ✅ |
| Open/Closed state | ✅ (via status) | ✅ |
| Labels | ✅ | ✅ |
| Milestone | ✅ | ✅ |
| Assignees (multi) | ✅ | ✅ |
| Dependencies | ✅ | ✅ (Forgejo native) |
| Priority | ✅ | ✅ Forgejo, ❌ GitHub |
| Subtasks / parent | ✅ | ❌ native (checklist workaround) |
| Acceptance Criteria | ✅ (structured) | ❌ (raw text only) |
| Definition of Done | ✅ | ❌ |
| Ordinal / manual sort | ✅ | ❌ |
| **Reactions / emojis** | ❌ **MISSING** | ✅ (DB table) |
| **Chronological comments** | ❌ **MISSING** | ✅ (39+ CommentTypes) |
| **Comment author + timestamp** | ❌ **MISSING** | ✅ |
| **Activity timeline** | ❌ **MISSING** | ✅ |
| **External ID mapping** | ❌ **MISSING** | ✅ (OriginalAuthorID) |
| **PR linkage** | ❌ **MISSING** | ✅ (IsPull flag) |
| Created/Updated timestamps | ✅ | ✅ |
| File attachments | ❌ | ✅ |

**Key insight:** Backlog.md has several fields Forgejo lacks (Acceptance Criteria, DoD, ordinal, structured subtasks). Forgejo has several fields Backlog.md lacks (reactions, chronological comments with author attribution, activity timeline, PR linkage).

---

## 3. Integration Architecture Options

### Option A: ExternalTracker Redirect (0 dev effort)

Configure Forgejo repo to use `TypeExternalTracker` pointing at the Backlog.md web UI server.

```
ExternalTrackerURL: https://backlog.my-org.com
ExternalTrackerFormat: https://backlog.my-org.com/tasks/{index}
ExternalTrackerStyle: alphanumeric
```

- ✅ Works **today** with zero code changes
- ✅ Backlog.md web UI is the canonical view
- ❌ Leaves Forgejo UI — no in-forge display
- ❌ No write-back from Forgejo
- ❌ Mutually exclusive with native Forgejo issues
- **Effort:** 1 hour (config) | **Risk:** None

### Option B: Custom Forgejo "BacklogSource" Unit (new UnitType)

Add `TypeBacklogIssues` as a new Forgejo unit type. On `/issues`, instead of querying DB, read `backlog/tasks/*.md` from git, display in issue-list-like UI. Write-back via git commit.

- ✅ In-forge display with native feel
- ✅ Uses existing Forgejo git file editor for write-back
- ✅ No DB changes to Backlog.md format required upfront
- ✅ Can coexist alongside native issues (separate tab/unit)
- ❌ Requires new router, templates, "virtual Issue" structs from markdown
- ❌ Reactions/comments need Backlog.md format extensions first
- ❌ Forgejo-specific (GitHub/GitLab need separate implementations)
- ❌ Performance: git tree read on every page load (needs caching)
- **Effort:** 6-10 weeks | **Risk:** Medium

### Option C: Bidirectional Sync Daemon

External daemon watches Forgejo webhooks AND git push events. Syncs: Forgejo issue → git commit on `backlog/tasks/*.md`; new/changed `.md` files → Forgejo API calls.

- ✅ Both systems work independently
- ✅ Forge-agnostic (GitHub, GitLab, Forgejo all work)
- ❌ Complex conflict resolution (concurrent edits → merge conflicts)
- ❌ Extra infrastructure (daemon, webhooks, polling)
- ❌ Data loss: reactions/comments have no markdown equivalent yet
- ❌ Eventual consistency: UI lag
- **Effort:** 6-12 weeks | **Risk:** High

### Option D: Forgejo File Renderer for backlog/tasks/*.md

Register a custom `markup.Renderer` that detects files under `backlog/tasks/` and renders them as rich task cards in Forgejo's file browser.

- ✅ Zero new infrastructure
- ✅ Works in file browser (`/src/branch/backlog/tasks/BACK-123.md`)
- ✅ Minimal code (~200-300 LOC Go)
- ✅ Uses existing `RegisterRenderer()` plugin system
- ❌ Not in the Issues tab — lives in the file browser
- ❌ No issue list/filter/search UX
- ❌ No reactions/comments
- **Effort:** 1-2 weeks | **Risk:** Low

### Option E: Forgejo BacklogSource + Native Issue Mirroring (Hybrid)

Import backlog tasks into Forgejo DB as read-only "mirrors". On Forgejo reaction/comment: append to markdown via git commit. On task edit: update DB mirror.

- ✅ Best UX: full native Forgejo issue features
- ✅ No data loss for forge-specific features
- ❌ Massive complexity: mirroring logic, concurrency, event ordering
- ❌ DB/markdown divergence risk
- **Effort:** 12-20 weeks | **Risk:** Very High

---

## 4. UX/UI Design Questions

### 4.1 Single Tracker or Dual Display?

The current Forgejo constraint (`TypeIssues` XOR `TypeExternalTracker`) means you cannot natively show both systems simultaneously without code changes. Options:

1. **Replace native issues entirely** with BacklogSource — lose Forgejo issue history
2. **Add new unit tab** "Backlog Tasks" alongside "Issues" — requires relaxing the mutual exclusion constraint
3. **Show both in the same list** — needs visual distinction (badge, color, icon)

### 4.2 Write-Back UX

Three levels of sophistication:

1. **None (read-only):** Use Backlog.md web UI or CLI for all writes. Forgejo shows tasks read-only. Simple, zero conflict risk.
2. **File editor write-back:** User edits raw markdown via Forgejo's existing file editor. Works today, but exposes raw frontmatter to non-technical users.
3. **Custom task form:** Forgejo form that writes structured frontmatter via git commit. Best UX, ~3-4 weeks extra dev.

### 4.3 Reactions in Markdown

Proposed frontmatter format:
```yaml
reactions:
  "+1": ["@user1", "@user2"]
  "heart": ["@user3"]
  "rocket": ["@user1"]
```

Issues:
- One git commit per reaction click → expensive, noisy git history
- Need batch commit or debounce strategy
- Timestamps for reactions lost (frontmatter has no per-value timestamps)
- Alternative: reaction metadata in `## Reactions` section with timestamps

### 4.4 Comments in Markdown

Proposed `## Comments` section format:
```markdown
## Comments

<!-- comment:2026-05-17T14:30:00Z:@username -->
Comment text here. Can be multi-line markdown.
<!-- /comment -->

<!-- comment:2026-05-18T09:15:00Z:@other-user -->
Reply content here.
<!-- /comment -->
```

Advantages: structured enough for parsing, survives raw markdown viewing.  
Alternative: separate sidecar file `backlog/tasks/BACK-123.comments.md`.  
Problem: author attribution requires forge username → Backlog.md username mapping.

### 4.5 ID Namespacing

- Backlog.md: `BACK-123` (alphanumeric prefix)
- Forgejo native: `#123` (numeric)

If backlog tasks appear as Forgejo issues, which ID wins? Options:
- Keep `BACK-123` alphanumeric (Forgejo supports `ExternalTrackerStyle=alphanumeric`)
- Assign new Forgejo numeric IDs and cross-reference
- Use alphanumeric style: `BACK-123` renders as `BACK-123` in Forgejo, not `#123`

### 4.6 Completed Tasks

- Backlog.md: done tasks move from `backlog/tasks/` to `backlog/completed/`
- Forgejo: closed issues stay in DB with `IsClosed=true`

Sync options:
1. Status `Done` → Forgejo `IsClosed=true`, file stays in `tasks/`
2. File moves to `completed/` → Forgejo "closes" the virtual issue
3. Separate "Completed" tab showing `backlog/completed/*.md`

### 4.7 Kanban Board Mapping

Backlog.md uses a `status` field for Kanban columns. Forgejo Projects has `project_board` columns. Natural mapping: Backlog.md statuses → Forgejo project columns. This could make Forgejo's native Kanban UI display Backlog.md tasks on a board.

---

## 5. Showstoppers / Critical Problems

### 5.1 Mutual Exclusion (BLOCKER for Option B as-is)
`TypeIssues` and `TypeExternalTracker` are mutually exclusive (`models/unit/unit.go:242`). A new `TypeBacklogIssues` unit alongside native issues requires relaxing this constraint in Forgejo core.

**Mitigation:** Add `TypeBacklogIssues` as an entirely separate unit type that doesn't participate in the mutual exclusion group — it's not "an issue tracker" but "a backlog reader".

### 5.2 Comment Author Attribution
Forgejo user (e.g., `johndoe`) comments on a backlog task. We need to write `<!-- comment:...:@johndoe -->` to markdown. Username mapping is straightforward, but the Backlog.md CLI/MCP would need to accept external author attribution, which it currently doesn't.

### 5.3 Conflict Resolution
Concurrent edit via Forgejo web UI (git commit) + direct `git push` → merge conflict on the `.md` file. Forgejo already handles file edit conflicts with an error UI, but integrating this gracefully with "issue editing" UX is non-trivial.

**Mitigation:** Require PR-based workflow for direct task edits; Forgejo form only writes via fast-forward commits with conflict detection.

### 5.4 Performance at Scale
Reading 200+ markdown files from git on every `/issues` page load is O(n) git operations. At 1000 tasks this becomes unacceptably slow.

**Required:** In-memory cache keyed by commit SHA (invalidated on push), or a pre-built `backlog/.cache.json` index maintained by Backlog.md CLI on every write.

### 5.5 Missing Fields Before Write-Back
Forgejo reactions and comments have no current markdown representation in Backlog.md. Writing reactions/comments back requires format extension BEFORE building the Forgejo UI, otherwise write-backs have nowhere to persist.

### 5.6 Forge Specificity
Option B (custom Forgejo unit) is Forgejo-specific. GitHub and GitLab would need separate implementations or the sync daemon (Option C). Only format extension (Phase 0) and the sync daemon are forge-agnostic.

### 5.7 Upstream Acceptance Risk
A Forgejo upstream PR adding `TypeBacklogIssues` named as a "Backlog.md integration" will likely be rejected. Must be framed as a generic **"git-backed issue source"** that can read any directory of structured markdown files as issues — Backlog.md is just one possible source format.

---

## 6. Effort Estimates

| Work Item | Effort | Profile |
|-----------|--------|---------|
| Option A: ExternalTracker config + docs | 1 day | DevOps |
| **Phase 0: `reactions` field spec + implementation** | 3 days | TS dev |
| **Phase 0: `## Comments` section spec + implementation** | 1 week | TS dev |
| **Phase 0: `external_id` / `forge_refs` field** | 1 day | TS dev |
| **Phase 0: `forge-schema-spec.md` doc** | 3 days | Tech writer |
| Phase 0: MCP tool updates for new fields | 2 days | TS dev |
| Option D: Forgejo file renderer (task card HTML) | 1-2 weeks | Go dev |
| Option D: Integration test | 3 days | Go dev |
| Option B: `TypeBacklogIssues` unit + router (read-only) | 4-6 weeks | Go dev (senior) |
| Option B: SHA-based task cache | 1 week | Go dev |
| Option B: task list template | 1 week | Go + frontend dev |
| Option B: task detail template | 1 week | Go + frontend dev |
| Option B: task edit form → git commit write-back | 2-3 weeks | Go + frontend dev |
| Option B: reactions write-back | 2 weeks | Go dev |
| Option B: comments write-back | 2 weeks | Go dev |
| Option C: sync daemon (full) | 6-10 weeks | Go/TS dev |
| Performance: caching layer | 1-2 weeks | Go dev |
| Integration test suite | 1-2 weeks | QA/Go dev |
| Migration guide | 3 days | Tech writer |

**Total by phase:**
- **Option A only:** ~1 day
- **Phase 0 (schema) + Option D (renderer):** ~5-6 weeks
- **Phase 0 + Option B (full, read-only):** ~12-14 weeks
- **Phase 0 + Option B (full, with write-back):** ~16-20 weeks
- **Option C (sync daemon):** ~8-12 weeks (forge-agnostic but high risk)

---

## 7. Recommended Phased Approach

### Phase 0 — Schema Stabilization (2 weeks, Backlog.md side)
**Do this before any Forgejo work.** Extend Backlog.md's task format so it's ready for forge read/write:
1. Add `reactions` frontmatter field (spec + parser + serializer + MCP)
2. Add `## Comments` section with HTML-comment-delimited structured entries
3. Add `external_id` / `forge_refs` field for cross-system ID mapping
4. Publish `backlog/docs/forge-schema-spec.md` as machine-readable schema

**Deliverable:** Backlog.md tasks can round-trip all forge-relevant data.

### Phase 1 — Quick Win: Forgejo File Renderer (1-2 weeks, Go side)
Build a `markup.Renderer` implementation for `backlog/tasks/*.md` files:
- Detects files by path prefix (`backlog/tasks/`)
- Parses YAML frontmatter + body sections
- Renders as styled HTML task card (status badge, priority, labels, assignees, ACs, DoD)
- Register via `init()`, zero Forgejo-core changes
- **Parallel to this:** Configure ExternalTracker redirect to Backlog.md web UI

**Deliverable:** Clicking any `backlog/tasks/BACK-*.md` file in Forgejo file browser shows a beautiful rendered task card instead of raw markdown.

### Phase 2 — Full BacklogSource Unit (6-8 weeks, Go + frontend)
After schema is stable and Phase 1 is validated:
1. New `TypeBacklogIssues` unit in `models/unit/unit.go`
2. Router: `/issues` reads tasks from git via SHA-keyed cache
3. Templates: task list + task detail with all Backlog.md fields
4. Write-back: "Edit task" form → structured frontmatter → git commit
5. Sidebar: Status/Priority/Assignees/Labels/Milestone in Forgejo sidebar UX

**Deliverable:** Backlog tasks appear as first-class issues in Forgejo's Issues tab with full CRUD.

### Phase 3 — Reactions & Comments (4-6 weeks, Go)
1. Forgejo reaction click → appends to `reactions:` frontmatter via git commit
2. Forgejo comment form → appends to `## Comments` section via git commit  
3. Render existing markdown comments in Forgejo comment UI
4. Conflict detection + UX for concurrent edits

**Deliverable:** Full bidirectional reactions and comments via git.

### Phase 4 — Multi-Forge (Future / Optional)
- GitHub: Actions-based sync workflow
- GitLab: CI-based sync pipeline
- Or generic sync daemon (Option C) for all forges

---

## 8. Tickets Spawned by This Study

See the Backlog.md task tracker for these task groups:

### Group 0: Schema & Spec (start now, unblocks everything)
Tasks tagged `forge-schema`: reactions field, comments section, external_id field, schema spec document.

### Group 1: Analysis Tasks (for deeper investigation before coding)
- Research mutual exclusion relaxation in Forgejo unit system
- Performance benchmark: parsing 200+ markdown files in Go
- Security review: HTML injection via malicious task frontmatter
- Git write-back atomicity analysis
- Upstream Forgejo submission strategy

### Group 2: Forgejo Renderer (Phase 1)
- Implement `markup.Renderer` for task files
- Integration tests with Forgejo dev server

### Group 3: BacklogSource Unit (Phase 2)
- New unit type, router, cache, templates, write-back form

### Group 4: Reactions & Comments (Phase 3)
- Write-back handlers, conflict resolution UX

---

## 9. Open Questions for Stakeholders

1. **Forge priority:** Forgejo-first, or should we target GitHub (larger audience)?
2. **Write-back scope:** Read-only display + Backlog.md CLI for writes, or full in-forge editing?
3. **Issue coexistence:** Can a repo have both Forgejo native issues AND Backlog tasks? Or replace entirely?
4. **Comment format:** HTML comments in markdown body vs. sidecar `.comments.md` file?
5. **Upstream contribution:** Should the Forgejo renderer be submitted upstream as "generic git-backed issue source"?
6. **Reactions in git:** Is a git commit per reaction acceptable? (Noisy history) Or batch + debounce?

---

*This document is the canonical output of the 2026-05-17 feasibility analysis session. It should be kept as reference for all subsequent forge integration work.*
