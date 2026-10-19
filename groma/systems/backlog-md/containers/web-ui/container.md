---
type: C4 Container
title: Web UI
status: stable
groma:
  id: web-ui
  parent: backlog-md
  technology: React, React Router, Tailwind CSS
description: Browser app for the board, task editing, milestones, docs and settings
---

A single-page app bundled into the executable and served by `backlog browser`. It talks only to the local web server: JSON over HTTP for reads and changes, and a WebSocket that says when tasks, milestones or config changed so views refresh in place. Desktop first, with best-effort narrow-screen layouts.
