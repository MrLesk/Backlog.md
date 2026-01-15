---
id: BACK-199
title: Add version parameter to board export command
status: Done
assignee: []
created_date: '2025-07-22'
labels: []
dependencies: []
---

## Description

Enable users to include custom version strings when exporting Kanban boards. This allows for better versioning in exports and enables the release workflow to include the actual version number in README updates.

## Acceptance Criteria

- [x] Board export command accepts --export-version parameter
- [x] Version string is displayed in exported board header
- [x] Parameter accepts any custom string format
- [x] README documentation includes usage examples

## Implementation Notes

Implemented --export-version option for the board export command. Used this parameter name to avoid conflict with commander.js built-in --version flag. The version string is passed as-is without modification, allowing users to use any format they prefer. Updated release workflow to use this new parameter. Also updated README with examples showing various version formats.
