---
id: BACK-188
title: Add zero-padded IDs configuration option
status: Done
assignee:
  - '@mjgs'
created_date: '2025-07-12'
updated_date: '2025-07-13'
labels:
  - feature
  - config
  - ids
  - formatting
dependencies: []
priority: medium
---

## Description

Add support for zero-padded IDs for tasks, documents, and decisions to enable consistent formatting and better lexicographical sorting. When enabled through the `zeroPaddedIds` configuration option, newly generated IDs will be left-padded with zeros to the specified length (e.g., `task-001`, `doc-001` instead of `task-1`, `doc-1`).

## Acceptance Criteria

- [x] Add `zeroPaddedIds` configuration option to specify padding width
- [x] Update ID generation for tasks, documents, and decisions to support padding
- [x] Add sub-task ID padding with fixed 2-digit format (e.g., `task-001.01`)
- [x] Maintain backward compatibility - padding disabled by default (value 0)
- [x] Add configuration validation to ensure reasonable padding limits (1-10 digits)
- [x] Make padding configurable via `backlog config set zeroPaddedIds <number>`
- [x] Add comprehensive E2E tests for padded and non-padded ID generation
- [x] Update documentation explaining the new configuration option

## Implementation Plan

1. Add `zeroPaddedIds` field to BacklogConfig type
2. Update `generateNextId`, `generateNextDocId`, and `generateNextDecisionId` functions
3. Implement conditional padding logic using `String.padStart()`
4. Add configuration get/set support for zeroPaddedIds
5. Create comprehensive test suite covering all scenarios
6. Update README with configuration documentation

## Technical Details

The implementation uses `String.padStart()` to apply zero-padding when `config.zeroPaddedIds` is greater than 0. Sub-task IDs automatically use 2-digit padding for the decimal portion regardless of the main padding setting to ensure consistent formatting of hierarchical IDs.

## Implementation Notes

Added support for zero-padded IDs across all item types through a new `zeroPaddedIds` configuration option. The implementation includes:

- **ID Generation**: Modified CLI functions to check config and apply padding using `String.padStart()`
- **Sub-task Support**: Fixed 2-digit padding for sub-task portions (e.g., `task-001.01`)
- **Configuration**: Full integration with config system including get/set commands
- **Configuration management through `backlog config set zeroPaddedIds <number>`
- Setting to 0 or using `backlog config set zeroPaddedIds 0` disables padding
- **Validation**: Padding limited to 1-10 digits for practical use
- **Testing**: Comprehensive E2E tests covering enabled/disabled scenarios and all item types

This feature improves file organization and provides consistent formatting that aligns with common issue tracking conventions.