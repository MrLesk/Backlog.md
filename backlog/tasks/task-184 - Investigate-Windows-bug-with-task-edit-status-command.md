---
id: task-184
title: Investigate Windows bug with task edit status command
status: In Progress
assignee:
  - '@claude'
created_date: '2025-07-13'
updated_date: '2025-07-13'
labels: []
dependencies: []
priority: high
---

## Description

Verified if 'backlog task edit 123 -s "In progress"' command works correctly on Windows. Found and fixed issue with quote handling and command argument parsing.

## Root Cause
The issue was caused by a conflict between Commander.js command definitions:
1. Specific command: \ with \ for setting status
2. Fallback command: \ that was missing filtering options like 
When the fallback command didn't support the same options as the list command, it would incorrectly reject valid filtering arguments, causing the "too many arguments" error.

## Solution  
Enhanced the fallback command to support all the same filtering options as the list command:
- \ for filtering by status
- \ for filtering by assignee  
- \ for filtering by parent task
- \ for filtering by priority
- \ for sorting results

This allows both use cases to work correctly:
- \ (edit status)
- \ (filter and view)

## Test Results
All command variations now work correctly on Windows:
- Edit commands with quoted status values  
- Filtering commands with and without taskId
- Mixed usage patterns
