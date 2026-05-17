---
id: BACK-502
title: >-
  Forge Integration Analysis: Upstream Forgejo submission strategy — frame
  BacklogSource as generic "git-backed issue source"
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 19:58'
labels:
  - forge-integration
  - forgejo
  - analysis
  - community
  - strategy
  - research
milestone: m-7
dependencies: []
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
priority: low
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Strategic analysis for making the Forgejo integration upstreamable. A PR titled "Add Backlog.md integration" will likely be rejected by the Forgejo project as too niche. To maximize chances of upstream acceptance, the feature must be framed as a **generic, configurable "git-backed issue source"** — a new RepoUnit type that can be configured to read any directory of structured markdown files with a configurable schema.

**Research questions:**
1. What is Forgejo's contribution process? (CONTRIBUTING.md, design proposal requirements, governance)
2. Are there existing Forgejo issues/discussions about "file-based issues" or "git-native issues"?
3. What generic configuration interface would allow Backlog.md AND other structured-markdown systems (e.g., a custom tool with different frontmatter) to both work?
4. Which Forgejo maintainers would be receptive? Any existing community interest?
5. Is there a Gitea/Forgejo feature request tracker where this concept has been discussed?

**Proposed generic interface:**
```yaml
# .forgejo/backlog-source.yaml
source_type: git-markdown-issues
tasks_directory: backlog/tasks
completed_directory: backlog/completed
schema_version: 1
id_field: id
title_field: title
status_field: status
labels_field: labels
# etc.
```

**Deliverable:** Implementation Notes with: (a) Forgejo contribution process summary, (b) existing community discussions found, (c) draft framing for the RFC/proposal, (d) go/no-go recommendation for upstream submission vs. maintaining as a fork/plugin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Forgejo contribution process documented (where to propose, review timeline expectations)
- [ ] #2 Web search for existing 'file-based issues' discussions in Forgejo/Gitea community completed
- [ ] #3 Generic configuration interface designed (not Backlog.md-specific)
- [ ] #4 Draft RFC title and one-paragraph abstract written
- [ ] #5 Go/no-go recommendation for upstream submission vs. fork
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
