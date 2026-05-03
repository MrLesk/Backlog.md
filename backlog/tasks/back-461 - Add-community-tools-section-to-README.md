---
id: BACK-461
title: Add community tools section to README
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-05-03 10:53'
updated_date: '2026-05-03 11:02'
labels:
  - docs
  - community
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/515'
modified_files:
  - README.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track PR #515, which adds a small Community Tools section to the main README so users can discover community-maintained integrations without treating them as official core features. The current contribution links the vscode-backlog-md extension and its source repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README includes a Community Tools section near the existing documentation/footer area.
- [x] #2 The vscode-backlog-md entry links both the Visual Studio Marketplace listing and source repository.
- [x] #3 The PR title/body/task references use this new task ID instead of the conflicting BACK-451 ID.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Push BACK-461 to main as the non-conflicting task for PR #515.
2. Update PR #515 to remove the conflicting BACK-451 task file and retitle/reference BACK-461.
3. Wait for CI and Codex on the updated PR branch before marking the task Done.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #515 after rebasing it onto current main, removing the conflicting BACK-451 task file from the contributor branch, updating the PR title/body to BACK-461, approving and waiting for fork CI, and receiving Codex no-major-issues approval. The merged diff adds a Community Tools README section with links to vscode-backlog-md on the Visual Studio Marketplace and GitHub.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
