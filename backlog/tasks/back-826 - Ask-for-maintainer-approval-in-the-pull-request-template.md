---
id: BACK-826
title: Ask for maintainer approval in the pull request template
status: Done
assignee:
  - '@codex'
created_date: '2026-11-22T14:05:00Z'
updated_date: '2026-11-22T14:08:00Z'
labels: []
dependencies: []
references:
  - .github/PULL_REQUEST_TEMPLATE.md
  - CONTRIBUTING.md
  - https://github.com/MrLesk/Backlog.md/issues/1253
modified_files:
  - .github/PULL_REQUEST_TEMPLATE.md
  - CONTRIBUTING.md
type: docs
ordinal: 422000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The template currently lets an issue number or a Backlog task stand in for agreement to a pull request. Contributors and reviewers need a direct link to the maintainer’s decision on the proposed change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Before opening a PR, contributors are asked to link the issue comment where a project maintainer explicitly agreed to a PR for that change, or the issue description if the maintainer requested the PR there.
- [x] #2 The template asks for the associated Backlog task separately from maintainer approval.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Replace the issue-or-task prompt with a maintainer approval link and retain the separate Backlog task, summary, and testing prompts. Check the rendered Markdown and existing links.

Point the existing pull-request step in CONTRIBUTING.md to the same template requirement.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The PR template asks first for the issue comment approving a PR for the specific change. A maintainer’s request in the issue description also counts. The Backlog task has a separate field, and the contribution guide points to the same requirement. Verified the rendered Markdown, links, task command and four checklist items. Type checks, Biome and 18 instruction tests passed.
<!-- SECTION:FINAL_SUMMARY:END -->
