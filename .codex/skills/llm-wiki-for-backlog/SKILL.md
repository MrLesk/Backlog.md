---
name: llm-wiki-for-backlog
description: "Build and maintain LLM-powered personal knowledge bases using the Karpathy Wiki pattern, adapted for Backlog.md workflow. The LLM incrementally compiles backlog sources into a persistent, interlinked markdown wiki. Trigger: 'build wiki', 'init wiki', 'ingest', 'process source', 'wiki query', 'lint wiki', 'health check', 'knowledge base', '知识库', '整理', '摄取'."
---

# LLM Wiki Skill (Backlog.md Adaptation)

Personal knowledge base where the LLM is the sole maintainer. Human feeds sources via Backlog.md and asks questions. LLM compiles, cross-references, and maintains everything.

## Core Idea

**This is NOT RAG.** RAG re-derives knowledge from scratch on every query — no accumulation. Here, the LLM **incrementally compiles** backlog sources into a persistent, interlinked wiki. Knowledge is built once and kept current. The wiki is a compounding artifact: every source added and every question asked makes it richer.

- **Human's two jobs:** Feed raw materials into Backlog.md. Ask good questions.
- **LLM's job:** Everything else — summarize, cross-reference, file, maintain, lint.
- **The wiki:** A living, compiled artifact that only grows.

> Backlog.md is the IDE. The LLM is the programmer. The wiki is the codebase.

---

## Architecture

### Three Content Layers + Schema

```
{project-root}/
├── src/                      # Project source code (optional raw source when backlog lives inside a project repo)
├── {backlog}/                # Backlog.md working directory
│   ├── tasks/                # Layer 1: Human input. Tasks, issues, requirements.
│   ├── docs/                 # Layer 1: Human input. Documents, guides, references.
│   ├── decisions/            # Layer 1: Human input. ADRs, decision records.
│   ├── drafts/               # Layer 1: Human input. Draft ideas, WIP notes.
│   ├── milestones/           # Layer 1: Human input. Milestone definitions and tracking.
│   ├── archive/              # Layer 1: Human input. Archived tasks and records.
│   ├── completed/            # Layer 1: Human input. Completed task records.
│   ├── assets/               # Layer 1: Human input. Images, attachments, resources.
│   ├── wiki/                 # Layer 2: LLM maintains entirely. Human reads/browses.
│   │   ├── index.md          # Content catalog — LLM's navigation map
│   │   ├── log.md            # Chronological ops log (append-only)
│   │   ├── overview.md       # High-level synthesis of the entire knowledge base
│   │   ├── sources/          # One summary per backlog source (task, doc, decision, etc.)
│   │   ├── concepts/         # Concept articles extracted from backlog
│   │   ├── entities/         # People, tools, projects, orgs mentioned in backlog
│   │   ├── comparisons/      # Cross-cutting analyses across tasks/docs/decisions
│   │   └── usermanual/       # Optional: structured user manual (see UserManual section below)
│   └── wiki_output/          # Layer 3: Query products. Valuable results → flow back to wiki/
│       ├── reports/
│       ├── slides/           # Marp format
│       └── charts/           # matplotlib / visualization
└── ...                       # Other project files (config, tests, etc.)
```

**Iron rules:**
1. **Backlog folders (`tasks/`, `docs/`, `decisions/`, `drafts/`, `milestones/`, `archive/`, `completed/`, `assets/`) are immutable** — the LLM NEVER modifies backlog source files
2. `wiki/` is **LLM-owned** — human reads/browses, LLM writes everything
3. `wiki_output/` → `wiki/` **flowback** is the compounding mechanism
4. **NEVER recursively process `wiki/` or `wiki_output/` themselves** — they live inside the backlog directory but are excluded from ingestion
5. **Project source code directories are optional raw sources** — When the backlog directory lives inside a project repository, sibling source directories (e.g. `src/`, `lib/`, `packages/`) may also be ingested as an extension of the raw layer

### Project Source Code (Optional Raw Source)

When `backlog/` resides inside a project repository, the project source code directories at the same level as (or parent to) the backlog folder may also be ingested:

| Directory | Purpose | Ingest Strategy |
|---|---|---|
| `src/` | Implementation source files, modules, components | Extract architectural patterns, API surfaces, module boundaries |
| `lib/` | Shared libraries, utility code | Extract reusable patterns, dependency graphs |
| `packages/` | Monorepo packages | Extract package boundaries, inter-package contracts |
| Repository root | Config files, entry points | Extract build setup, entry-point structure |

**Source code exclusions (always apply):**
- Build artifacts: `dist/`, `build/`, `out/`, `.next/`, `coverage/`
- Dependency directories: `node_modules/`, `vendor/`, `.venv/`, `target/`
- Generated files: auto-generated API clients, protobuf outputs (unless hand-edited)
- Lockfiles: treat as metadata only (do not ingest as primary source)
- Binary assets: images, videos, fonts (skip unless semantically relevant)

### Backlog Folder Purposes (Raw Layer)

| Folder | Purpose | Ingest Strategy |
|---|---|---|
| `tasks/` | Active and pending tasks with requirements, acceptance criteria, implementation notes | Extract requirements, technical specs, decisions made during implementation |
| `docs/` | Project documentation, guides, API references, READMEs | Extract domain knowledge, technical concepts, conventions |
| `decisions/` | Architecture Decision Records (ADRs), design choices, rationale | Extract decision context, trade-offs, rejected alternatives |
| `drafts/` | Draft ideas, brainstorming notes, work-in-progress thoughts | Extract nascent concepts before they mature into tasks or docs |
| `milestones/` | Milestone definitions, roadmap items, release plans | Extract high-level goals, dependencies, timeline context |
| `archive/` | Archived tasks and records no longer active | Historical context, patterns from past work |
| `completed/` | Completed task records with final summaries | Lessons learned, successful patterns, outcome documentation |
| `assets/` | Images, diagrams, attachments referenced by backlog items | Visual context, diagrams as knowledge sources |

### Wiki Guidelines in Agent Instructions

The wiki does not maintain a separate schema file. All wiki-related guidelines, conventions, and rules are stored directly in the project's existing Backlog.md agent instruction file (`CLAUDE.md`, `AGENTS.md`, or `GEMINI.md` in the project root).

**When `build wiki` is triggered:**
1. Locate the project's agent instruction file (whichever exists: `CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`)
2. Check if it already contains a `<!-- WIKI GUIDELINES START -->` marker
3. If not present, inject the wiki guidelines section (see "Wiki Guidelines Content" below) into the agent file
4. If already present, skip injection to avoid duplication

**When wiki conventions evolve:**
- Update the wiki section directly within the project's agent instruction file
- Do NOT create separate files for wiki schema or conventions
- The agent file is the single source of truth for both backlog workflow and wiki knowledge base rules

### Two Navigation Files

- **`index.md`** — Content-oriented catalog of every wiki page with one-line summaries, organized by type. The LLM reads this FIRST on any operation. Updated on every ingest.
- **`log.md`** — Chronological, append-only timeline. Format: `## [YYYY-MM-DD HH:mm:ss] {op} | {title}`. Parseable with `grep "^## \[" log.md`. Shows what happened when. The detailed timestamp enables git-aware incremental ingestion.

---

## Operations

### 1. Init

**Trigger:** "build wiki", "init wiki", "搭建知识库", or any request to create a knowledge base.

**Prerequisite Check:**

Before building the wiki, verify that Backlog.md has been initialized in the project:

1. Check for the existence of `backlog/config.yml` or `.backlog/config.yml` (or `backlog.config.yml` in the project root)
2. Check that the backlog directory structure exists (`backlog/tasks/`, `backlog/docs/`, etc.)

**If Backlog.md is NOT initialized:**
- **STOP** the wiki build process immediately
- Inform the user: "This project has not been initialized with Backlog.md. Please run `backlog init` first to set up the project structure, then we can build the wiki."
- Do NOT proceed with wiki creation until `backlog init` has been completed

**If Backlog.md IS initialized:**

1. **Understand the domain** — Ask: What topic/purpose? What backlog content do you have? What outputs do you care about? Also identify any project source directories to include (e.g. `src/`, `lib/`, `packages/`).
2. **Create `backlog/wiki/` directory structure** inside the Backlog.md working directory
3. **Inject wiki guidelines into the agent instruction file** — Locate the project's agent file (`CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`). If it does not already contain wiki guidelines, append the "Wiki Guidelines Content" section (defined below) to the file using `<!-- WIKI GUIDELINES START -->` / `<!-- WIKI GUIDELINES END -->` markers.
4. **Generate `wiki/index.md`** — Empty catalog with sections matching wiki subdirectories
5. **Generate `wiki/log.md`** — First entry: initialization
6. **Generate `wiki/overview.md`** — Placeholder awaiting first source
7. **Recommend setup:** Ensure wiki/ and wiki_output/ are in .gitignore if needed

### 2. Ingest

**Trigger:** "ingest this", "process this", "摄取", or referencing a new source to add.

**Exclusion rules (CRITICAL):**
- **NEVER** read or process files inside `backlog/wiki/` or `backlog/wiki_output/`
- **NEVER** ingest the wiki's own generated content as raw source
- Primary ingest sources: `tasks/`, `docs/`, `decisions/`, `drafts/`, `milestones/`, `archive/`, `completed/`, `assets/`
- Optional ingest sources: configured project source directories (e.g. `src/`, `lib/`) — exclude build artifacts, dependencies, and generated files

**Single source:**
1. Read the source thoroughly
2. Discuss key takeaways with user (3–5 bullets)
3. Create summary page in `wiki/sources/` with frontmatter linking back to original backlog file
4. For each significant concept → create or **update** page in `wiki/concepts/`
5. For each significant entity → create or **update** page in `wiki/entities/`
6. Update `wiki/index.md` with all new/changed pages
7. Update `wiki/overview.md` if the big picture shifts
8. Append to `wiki/log.md` with full timestamp `## [YYYY-MM-DD HH:mm:ss] {op} | {title}`

**Batch ingest all backlog content:**

1. **Determine the ingestion baseline** — Parse `wiki/log.md` to find the most recent `ingest` or `batch-ingest` entry and extract its timestamp. This is the baseline for incremental detection.

2. **Detect changed files (git-aware)** — Check if the project is inside a git repository:
   - **If git is available and the project is a git repo:**
     - Run `git status --porcelain` to list unstaged/untracked changes
     - Run `git log --since="{last_ingest_timestamp}" --name-only --pretty=format:` to list files changed in commits since the last ingestion
     - Combine both sets. A file is considered "updated" if it appears in either result.
     - Filter the combined set to only include files within the ingest source directories (backlog folders and configured project source directories).
   - **If git is not available or git commands fail:**
     - Fall back to full directory scanning (existing behavior: scan all source directories and cross-reference `log.md` for un-ingested files).

3. **Skip unchanged files** — If a file is not in the "updated" set and was already ingested (exists in `wiki/sources/` or is referenced in `log.md`), skip it.

4. **Process updated and new files** — For each file in the updated set plus any files not yet ingested:
   - Read and analyze the source
   - Create or update `wiki/sources/` pages
   - Extract/update concepts and entities
   - (skip discussion step in batch mode)

5. **Run mini-lint** after all sources processed

6. **Report summary** of what was added/updated/skipped

7. **Append to `wiki/log.md`** with full timestamp `## [YYYY-MM-DD HH:mm:ss] batch-ingest | {summary}`

**Page conventions:**
- Every page: YAML frontmatter with `type`, `title`, `updated` at minimum
- Source pages include `source_path` linking back to original backlog file
- All cross-references: `[[wikilinks]]`
- Filenames: lowercase-with-hyphens

### 3. Query

**Trigger:** User asks a question about wiki content.

1. Read `wiki/index.md` to locate relevant pages
2. Read those pages (work from compiled wiki, not raw backlog sources)
3. Synthesize answer with `[[wikilink]]` citations
4. Choose output format:
   - Simple factual → chat response
   - Comparison → table or `wiki/comparisons/` page
   - Deep analysis → `wiki_output/reports/{topic}.md`
   - Presentation → `wiki_output/slides/{topic}.md` (Marp)
   - Visualization → `wiki_output/charts/` (matplotlib)
5. **Flowback prompt** — For any non-trivial output: "This is worth keeping — want me to file it into the wiki?"

### 4. Lint

**Trigger:** "lint wiki", "health check", "检查 wiki", or suggest after every ~10 ingests.

**Scan the entire wiki for:**
- Contradictions between pages
- Stale claims superseded by newer backlog sources
- Orphan pages with no inbound links
- Concepts mentioned frequently but lacking dedicated pages
- Missing cross-references that should exist
- Data gaps fillable via web search
- Potential new connections and questions to investigate

**Output:** Report in `wiki_output/reports/lint-{date}.md`. Ask which issues to fix, then apply. Append to log.

---

## Conventions

### Essential Rules
- **`[[Wikilinks]]`** for ALL cross-references within the wiki — including `index.md` tables
- **YAML frontmatter** on every page: `type`, `title`, `updated` at minimum
- **Backlog source folders are immutable** — the LLM never writes to `tasks/`, `docs/`, `decisions/`, etc.
- **Filenames:** lowercase-with-hyphens
- **Exclude `wiki/` and `wiki_output/` from ingestion** — absolute rule to prevent recursion
- **The wiki is part of the git repo** — commit after significant operations

#### Wikilink Format (CRITICAL)

**Always** use `[[path/to/file]]` (without `.md` extension) for links between wiki pages. This is the only format that works consistently across Obsidian, GitLab, and other wikilink-aware tools.

**In `index.md` tables, use wikilinks in the first column:**

```markdown
| File | Title | Type | Desc |
|------|-------|------|------|
| [[sources/task-1-offline-encryption]] | TASK-1: Offline Encryption | Epic | Offline local encryption mechanism |
| [[concepts/keyvault]] | KeyVault | Concept | Core encryption key management |
```

**❌ NEVER use standard Markdown links for internal wiki pages:**
```markdown
| Source | Type | Summary |
|--------|------|---------|
| [source-security-module](sources/source-security-module.md) | source | Security module summary |
```

**✅ ALWAYS use wikilinks:**
```markdown
| Source | Type | Summary |
|--------|------|---------|
| [[sources/source-security-module]] | source | Security module summary |
```

---

## Wiki Guidelines Content (Inject into Agent File)

When injecting wiki guidelines into the project's agent instruction file, use the following content wrapped in markers:

```markdown
<!-- WIKI GUIDELINES START -->

## Wiki Knowledge Base

This project maintains an LLM-managed wiki inside the backlog directory for cross-referencing and compounding knowledge from tasks, docs, and decisions.

### Location
- `backlog/wiki/` — LLM-maintained knowledge base (do not edit manually)
- `backlog/wiki_output/` — Query products and generated artifacts

### Raw Sources (Human Input Layer)
The LLM reads from the following backlog folders as raw input. These are immutable for wiki purposes:
- `tasks/` — Requirements, acceptance criteria, implementation notes
- `docs/` — Documentation, guides, API references
- `decisions/` — ADRs, design choices, rationale
- `drafts/` — Draft ideas, brainstorming notes
- `milestones/` — Milestone definitions, roadmap items
- `archive/` — Archived tasks and records
- `completed/` — Completed task records with final summaries
- `assets/` — Images, diagrams, attachments
- `src/` (or other project source directories) — Project source code, implementation files (optional, when backlog is inside a project repo)

### Wiki Structure (LLM-Maintained Layer)
- `wiki/index.md` — Content catalog; read this FIRST on any operation
- `wiki/log.md` — Append-only chronological log (`## [YYYY-MM-DD HH:mm:ss] {op} | {title}`). The detailed timestamp enables git-aware incremental ingestion.
- `wiki/overview.md` — High-level synthesis of the entire knowledge base
- `wiki/sources/` — One summary per backlog source
- `wiki/concepts/` — Extracted concept articles
- `wiki/entities/` — People, tools, projects, organizations
- `wiki/comparisons/` — Cross-cutting analyses
- `wiki/usermanual/` — Optional structured user manual (see UserManual section below)

### UserManual (`wiki/usermanual/`)

An optional directory for rendering a structured, book-style user manual. It uses `SUMMARY.md` to define navigation and organizes content into numbered chapter folders.

**LLM instruction:** When building or maintaining `wiki/usermanual/`, read the full specification from this skill's bundled asset file before proceeding:
- **Read first:** `{skill-dir}/references/usermanual-writing-guide.md`

That file covers directory layout, naming conventions (`NN-章节名` folders, `NN-标题.md` pages), `SUMMARY.md` syntax rules, content style (de-numbered headings, heading-level usage), asset strategy (global vs chapter-private), extended syntax (Mermaid, Chart/Graph, raw HTML), and a pre-publish checklist.

**Merging into a single document:** This skill includes a Python tool to merge `README.md` + `SUMMARY.md` and all referenced pages into one auto-numbered markdown file. The tool lives at `{skill-dir}/scripts/merge.py`.

**LLM execution instruction:** When the user asks to merge or compile the usermanual, run the tool with the project source directory as input:
- **Input:** `backlog/wiki/usermanual/` (or the directory containing `README.md` + `SUMMARY.md`)
- **Output document:** `backlog/wiki_output/用户手册/manual.md`
- **Output assets:** `backlog/wiki_output/用户手册/assets/` (local images are copied here and paths are rewritten)

Key behaviors:
- `README.md` goes first (headings preserved, not numbered)
- `SUMMARY.md` `##` groups become `#` headings with numbers (`1`, `2`...)
- Page headings are downgraded by their SUMMARY depth:
  - SUMMARY level 2 (top link `- [Title]`): downgrade by 1 (`#` → `##`)
  - SUMMARY level 3 (nested `    - [Title]`): downgrade by 2 (`#` → `###`, `##` → `####`)
  - Deeper nesting follows the same pattern, capped at level 6
- **Title reconciliation**: If a page lacks a `#` heading, a synthetic one is inserted using the SUMMARY link title. If the page's `#` heading differs from the SUMMARY link title, the SUMMARY title wins.
- All headings are auto-numbered in a tree structure (`1.1`, `1.1.1`, `1.1.1.1`...)
- **Asset collection**: Local image references (`![alt](path)`) are resolved, copied to the output `assets/` folder, and rewritten as `assets/filename`
- Fenced code blocks are protected from mis-parsing; YAML frontmatter is stripped

### Rules
- **NEVER** write to `tasks/`, `docs/`, `decisions/`, or other backlog source folders during wiki operations
- **NEVER** recursively ingest `wiki/` or `wiki_output/`
- Use `[[wikilinks]]` for all cross-references within the wiki
  - **CRITICAL:** In `index.md` tables, use `[[path/to/file]]` (without `.md`) as the cell value, not standard Markdown links like `[text](path.md)`
  - Example: `| [[sources/task-1-feature]] | Task | Description |` — NOT `| [task-1](sources/task-1.md) | Task | Description |`
- Append-only for `wiki/log.md`
- YAML frontmatter on every wiki page: `type`, `title`, `updated`
- Filenames: lowercase-with-hyphens

### Operations
- **Ingest** — Read backlog sources, extract concepts/entities, create source summaries, update index/overview/log
  - **Git-aware incremental ingestion**: If the project is a git repo, use `git status --porcelain` and `git log --since="{last_ingest}"` to detect changed files since the last ingestion. Skip files that were already ingested and have not changed. Fall back to full scan if git is unavailable.
- **Query** — Read index, synthesize from compiled wiki, produce chat responses / reports / slides / charts
- **Lint** — Scan for contradictions, orphans, stale claims, missing cross-references
- **Flowback** — Save valuable query results back into the wiki for compounding

<!-- WIKI GUIDELINES END -->
```

---

## Scale Guidance

| Scale | Navigation | Tooling |
|---|---|---|
| Small (<50 sources) | `index.md` alone | None needed |
| Medium (50–200) | `index.md` + search | qmd: local BM25+vector search |
| Large (200+) | Chunked index + search | Full search infra |

---

## Key Tips

- **Backlog folders are your raw/** — Don't duplicate content. Use existing `tasks/`, `docs/`, `decisions/` as sources.
- **Flowback is the magic** — Every query result filed back makes future queries richer.
- **Ask analytical questions** — Not "summarize this task" but "compare approaches across these tasks, citing all sources and noting contradictions."
- **Co-evolve conventions** — Update the wiki section directly in the project's agent instruction file (`CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`) as conventions emerge. The agent file is the single source of truth for both backlog workflow and wiki rules.
- **Let the LLM suggest questions** — After lint or ingest, the LLM often surfaces connections and gaps.
