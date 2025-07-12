---
id: task-119
title: Add documentation and decisions pages to web UI
status: Done
assignee: []
created_date: '2025-07-06'
updated_date: '2025-07-06'
labels: []
dependencies: [task-118]
---

## Description

Implement dedicated pages for viewing and editing Documentation and Decisions in the web UI. Each page should display a list of markdown files with a beautiful rendered preview by default, and allow switching to an edit mode using the same markdown editor component used in task editing.

## Acceptance Criteria

### Documentation Page
- [x] List all markdown files from the `docs/` directory
- [x] Display file names as clickable items in a clean list/grid layout
- [x] Show rendered markdown content when a file is selected
- [x] Add "Edit" button that switches to edit mode
- [x] Use the same markdown editor component from task editing
- [x] Add "Save" and "Cancel" buttons in edit mode
- [x] Support creating new documentation files
- [x] Add search/filter functionality for documentation files

### Decisions Page
- [x] List all markdown files from the `decisions/` directory
- [x] Display decision files with ID, title, and date
- [x] Show rendered markdown content for selected decisions
- [x] Add "Edit" button for switching to edit mode
- [x] Use the same markdown editor component from task editing
- [x] Add "Save" and "Cancel" buttons in edit mode
- [x] Support creating new decision files with auto-generated IDs
- [x] Add filtering by status (Proposed, Accepted, Rejected, Superseded)

### API Endpoints
- [x] Add `/api/docs` endpoint for listing documentation files
- [x] Add `/api/docs/:filename` endpoint for reading/updating documentation
- [x] Add `/api/decisions` endpoint for listing decision files
- [x] Add `/api/decisions/:id` endpoint for reading/updating decisions

## Technical Notes

- Reuse the existing markdown editor component from TaskForm
- Implement proper syntax highlighting for code blocks in rendered markdown
- Consider using a markdown parsing library like marked or remark
- Add loading states while fetching file contents
- Implement error handling for file operations
- Consider adding a breadcrumb navigation for better UX
- Files should be displayed with metadata (last modified, file size)