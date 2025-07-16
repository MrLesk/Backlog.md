---
id: task-171
title: Implement drafts list functionality in CLI and web UI
status: Done
assignee: ['@claude']
created_date: '2025-07-12'
updated_date: '2025-07-16'
labels: []
dependencies: []
---

## Description

Add draft list functionality and promote draft actions to CLI and web UI. Include /api/drafts endpoint to web server to properly display drafts from backlog/drafts/ folder and enable promoting drafts to tasks.

## Acceptance Criteria

- [x] CLI draft list command displays all drafts from backlog/drafts/ folder
- [x] CLI draft promote command moves draft from drafts/ to tasks/ folder
- [x] Web UI /api/drafts endpoint returns drafts from filesystem
- [x] Web UI /api/drafts/:id/promote endpoint promotes draft to task
- [x] Web UI drafts page shows actual draft files with proper navigation
- [x] Web UI drafts page includes promote action button for each draft
- [x] Drafts are read from folder location not filtered by status field
- [x] Promoted drafts appear in tasks list and disappear from drafts list

## Implementation Notes

### Analysis
Found that most of the draft functionality was already implemented in the filesystem layer:
- Draft operations: listDrafts, loadDraft, createDraft, promoteDraft, archiveDraft
- CLI commands: create, archive, promote, view (but missing list)
- DraftsList component existed but was filtering by status instead of reading from drafts folder

### Implementation
1. **CLI draft list command** - Added full list command with plain text and interactive UI support
2. **API Endpoints**:
   - `/api/drafts` - Returns all drafts from the filesystem
   - `/api/drafts/:id/promote` - Promotes a draft to a task
3. **Web UI Updates**:
   - Updated DraftsList to fetch from `/api/drafts` instead of filtering tasks by status
   - Added a "Promote to Task" button for each draft with proper event handling
   - Maintained existing UI patterns and dark mode support

### Technical Details
- Used existing filesystem methods for all operations
- Followed existing patterns for CLI commands and API endpoints
- Maintained consistency with existing UI components and styling
- All acceptance criteria have been met and tested
