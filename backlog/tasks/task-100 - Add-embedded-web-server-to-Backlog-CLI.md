---
id: task-100
title: Add embedded web server to Backlog CLI
status: To Do
assignee: []
created_date: '2025-06-22'
labels: []
dependencies: []
---

## Description

Implement a web-based UI for Backlog.md that runs on localhost:3000, providing an HTML interface to view and manage tasks through the browser using React and shadcn/ui.

## Overview

This feature will embed a web server directly into the Backlog CLI executable, allowing users to interact with their tasks through a modern web interface while maintaining the CLI-first approach. The server will be built using Bun's native HTTP server capabilities and will serve a React-based single-page application.

## Architecture

### Backend

- **Bun.serve()** for the HTTP server
- RESTful API endpoints that leverage existing Core functions
- Static file serving from embedded assets

### Frontend

- **React 18** with TypeScript for the UI framework
- **shadcn/ui** with Tailwind CSS v4 for modern, accessible components (see decision-1)
- **react-markdown** for rendering task descriptions
- **Vite** as the build tool for development and production

### Key Features

1. **Interactive Kanban Board**: Drag-and-drop interface for managing tasks across statuses
2. **Task Management**: Full CRUD operations with modal dialogs
3. **Search & Filter**: Real-time filtering by status, assignee, labels
4. **Markdown Support**: Rich markdown preview and editing
5. **Responsive Design**: Mobile-first approach that works on all devices
6. **Dark Mode**: Built-in theme support via shadcn/ui
7. **Single Executable**: Everything bundled into the CLI binary

## Benefits

- **No external dependencies** needed at runtime - everything is bundled
- **Works offline** - no internet connection required
- **Better component management** with React's component model
- **Modern UI** with shadcn/ui's polished, accessible components
- **Type safety** throughout with TypeScript
- **Maintainable architecture** with clear separation of concerns
- **Easy distribution** - single executable contains everything
- **Rich UI for non-technical users** while maintaining CLI-first approach
- **Cross-platform** - works on Linux, macOS, and Windows

## Acceptance Criteria

- [ ] Users can run `backlog serve` to start web server
- [ ] Web UI displays all tasks in a Kanban board
- [ ] Users can create edit and archive tasks from web UI
- [ ] Server is embedded in the CLI executable
- [ ] Works on all supported platforms
