---
id: BACK-208
title: Add paste-as-markdown support in Web UI
status: To Do
assignee: []
created_date: '2025-07-26'
labels:
  - web-ui
  - enhancement
  - markdown
dependencies: []
priority: medium
---

## Description

Implement automatic conversion of rich text content to markdown when pasting into task and document editors, allowing users to seamlessly paste content from Word, Google Docs, web pages, and other sources while maintaining proper markdown formatting

## Acceptance Criteria

- [ ] Rich text content pasted into task edit fields is automatically converted to markdown
- [ ] Rich text content pasted into document edit pages is automatically converted to markdown
- [ ] Code blocks maintain proper formatting and syntax highlighting indicators
- [ ] Lists (ordered and unordered) are correctly converted to markdown syntax
- [ ] Links and formatting (bold, italic) are preserved in markdown format
- [ ] Tables are converted to markdown table syntax
- [ ] Smart paste detection only converts when rich text is detected (plain text pastes normally)
- [ ] Conversion works across major browsers (Chrome, Firefox, Safari, Edge)
- [ ] Users can still paste plain text without conversion when needed
- [ ] All existing paste functionality remains intact for non-rich text content
