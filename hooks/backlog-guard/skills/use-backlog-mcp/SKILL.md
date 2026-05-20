---
description: >-
  Use Backlog.md MCP tools and CLI instead of direct file access. Invoked when
  the agent needs to read, create, edit, search, or manage backlog tasks,
  documents, milestones, or configuration.
---

When working with Backlog.md data, **never read or edit backlog markdown files directly**.
All backlog data access must go through the MCP tools or the `backlog` CLI.

## Reading tasks

**Claude Code:** `mcp__backlog__task_view(id="BACK-NNN")`
**OpenCode:** `backlog_task_view(id="BACK-NNN")`
**CLI:** `backlog task BACK-NNN`

## Listing / searching tasks

**Claude Code:** `mcp__backlog__task_list(status="To Do")` / `mcp__backlog__task_search(query="keyword")`
**OpenCode:** `backlog_task_list(status="To Do")` / `backlog_task_search(query="keyword")`
**CLI:** `backlog task list` / `backlog search "keyword"`

## Creating tasks

**Claude Code:** `mcp__backlog__task_create(title="Title", description="...")`
**OpenCode:** `backlog_task_create(title="Title", description="...")`
**CLI:** `backlog task create "Title" -d "..."`

## Editing tasks

**Claude Code:** `mcp__backlog__task_edit(id="BACK-NNN", status="In Progress")`
**OpenCode:** `backlog_task_edit(id="BACK-NNN", status="In Progress")`
**CLI:** `backlog task edit BACK-NNN --set-status "In Progress"`

## Documents

**Claude Code:** `mcp__backlog__document_view(path="doc.md")` / `mcp__backlog__document_search(query="...")`
**OpenCode:** `backlog_document_view(path="doc.md")` / `backlog_document_search(query="...")`
**CLI:** `backlog doc doc.md` / `backlog doc create "Title"`

## Milestones

**Claude Code:** `mcp__backlog__milestone_list()`
**OpenCode:** `backlog_milestone_list()`
**CLI:** `backlog milestones`

## Configuration

**CLI:** `backlog config list` / `backlog config get <key>`
