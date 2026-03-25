---
id: BACK-308.06
title: Add completion installation command
status: Done
assignee: []
created_date: '2025-10-23 10:09'
updated_date: '2025-10-27 21:33'
labels:
  - cli
  - completion
  - installation
dependencies:
  - task-308.02
  - task-308.03
  - task-308.04
parent_task_id: task-308
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a 'backlog completion install' command that automatically installs the appropriate completion script for the user's shell.

The command should:
- Detect the current shell (bash, zsh, fish)
- Copy the completion script to the correct location
- Provide instructions for enabling completions if manual steps are needed
- Support both user-level and system-level installation
- Handle edge cases (e.g., shell config file doesn't exist yet)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 'backlog completion install' command implemented
- [x] #2 Shell detection works for bash, zsh, fish
- [x] #3 Completion script installed to correct location
- [x] #4 User receives clear instructions after installation
- [x] #5 Command handles missing config files gracefully
- [x] #6 Command supports '--shell' flag to specify shell manually
- [x] #7 Installation tested on macOS and Linux
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented comprehensive installation command in `/src/commands/completion.ts`:

**Features:**
- Auto-detects shell from `$SHELL` environment variable
- Supports manual shell specification via `--shell` flag
- Installs to user-specific directories (no sudo required)
- Creates installation directories if they don't exist
- Provides clear post-installation instructions for each shell
- Graceful error handling with manual installation fallback

**Installation Paths:**
- Bash: `~/.local/share/bash-completion/completions/backlog`
- Zsh: `~/.zsh/completions/_backlog`
- Fish: `~/.config/fish/completions/backlog.fish`

**Shell Detection:**
- Checks `$SHELL` environment variable
- Supports bash, zsh, and fish
- Falls back to manual selection if detection fails

**Error Handling:**
- Clear error messages for unsupported shells
- Fallback instructions for manual installation
- Handles missing completion script files
- Handles permission errors gracefully
<!-- SECTION:NOTES:END -->
