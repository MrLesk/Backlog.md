---
id: BACK-186
title: Fix unreliable ID generation causing duplicate IDs for new items
status: Done
assignee:
  - '@mjgs'
created_date: '2025-07-13'
labels:
  - bug
  - critical
  - data-integrity
dependencies: []
priority: high
---

## Description

Previously, the ID generation for new tasks, documents, and decisions was unreliable due to incorrect file pattern matching. The logic depended on parsing existing filenames with overly broad patterns like '*.md' instead of specific patterns like 'task-*.md', 'doc-*.md', 'decision-*.md'. This caused new items to often be created with non-incremented IDs like 'task-1' repeatedly, breaking data integrity and unique identification.

## Acceptance Criteria

- [x] Fix loadDecision to use 'decision-*.md' pattern instead of '*.md'
- [x] Fix saveDocument to normalize ID by removing 'doc-' prefix before filename creation
- [x] Add comprehensive E2E tests for task/document/decision ID incrementing
- [x] Ensure ID generation scans only relevant files for each item type
- [x] Prevent duplicate IDs that could corrupt task relationships and dependencies

## Implementation Notes

Root cause was broad file patterns in ID scanning logic that matched all markdown files including README.md. 

Fixed by adopting proper ID normalization patterns and specific file patterns. Added E2E tests that verify real CLI workflows create properly incremented IDs (task-1 → task-2, doc-1 → doc-2, decision-1 → decision-2).  
This fix prevents critical data integrity issues and ensures reliable unique identification throughout the system.
