---
type: C4 System
title: Git
description: Version history for the project and its tasks
status: stable
groma:
  id: git
  technology: git CLI
---

The project's Git repository, driven through the git command line. Backlog.md stages and commits task changes when autoCommit is on, lists recent local and remote branches, reads task files from them to show each task's most progressed copy, and fetches remotes when remoteOperations is on. Projects created with --no-git work without it.
