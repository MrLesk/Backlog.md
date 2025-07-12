---
id: task-119.2
title: Core architecture improvements and ID generation enhancements
status: Done
assignee: []
created_date: '2025-07-12'
labels: []
dependencies: []
parent_task_id: task-119
---

## Description

Enhanced core architecture with improved ID generation for documents and decisions, cross-branch collision detection, and better data flow between CLI and web components. These improvements were necessary for production robustness.

## Acceptance Criteria

- [x] Implement generateNextDocId with cross-branch collision detection
- [x] Implement generateNextDecisionId with cross-branch collision detection
- [x] Add createDocumentWithId method to core for ID management
- [x] Update createDecisionWithTitle to use improved ID generation
- [x] Enhance server-side ID management to prevent conflicts
- [x] Improve data flow consistency between CLI and web UI
- [x] Add proper ID normalization for decisions to prevent double-prefixing
- [x] Ensure robust ID generation across all components

## Implementation Notes

These core architecture improvements were essential for preventing ID conflicts and ensuring data consistency across the application. The work included implementing cross-branch ID collision detection, improving the core API surface, and ensuring proper ID management throughout the system. While not explicitly required by the original tasks, these improvements were necessary for a robust, production-ready system.
