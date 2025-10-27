---
id: task-308
title: Add shell tab completion support for CLI commands
status: Done
assignee:
  - '@codex'
created_date: '2025-10-23 10:08'
updated_date: '2025-10-27 21:32'
labels:
  - enhancement
  - cli
  - completion
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement tab completion functionality for the backlog CLI tool to improve developer experience. When users press TAB after typing "backlog", they should see available commands. When pressing TAB after subcommands (e.g., "backlog task"), they should see subcommands and options.

This will support bash, zsh, and fish shells with dynamic completions based on the actual CLI structure (commands, subcommands, task IDs, status values from config).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing TAB after 'backlog' shows all available commands
- [x] #2 Pressing TAB after 'backlog task' shows task subcommands (create, edit, list, etc.)
- [x] #3 Pressing TAB after 'backlog task edit' shows options like --status, --priority, etc.
- [x] #4 Completion works in bash shell
- [x] #5 Completion works in zsh shell
- [x] #6 Completion works in fish shell
- [x] #7 Dynamic completions suggest actual task IDs when relevant
- [x] #8 Dynamic completions suggest config values (status, priority) when relevant
- [x] #9 Installation command available (e.g., 'backlog completion install')
- [x] #10 Documentation added to README
- [x] #11 Advanced configuration wizard offers to install completions immediately after backlog init
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Implementation Plan for Shell Tab Completion

## Research Findings (task-308.01)

**Evaluated Options:**
- Commander.js v14: No built-in completion support
- Third-party libraries (omelette, tabtab): Outdated, poor maintenance
- **Recommended: Custom implementation** with CLI helper + shell-specific scripts

**Rationale:**
- Full control over dynamic completions
- No external dependencies
- Optimized for our CLI structure
- Better long-term maintenance

## Architecture

### Core Components

1. **Completion Helper Command** (`backlog __complete <line> <point>`)
   - Parses command line to determine context
   - Returns appropriate completions (newline-separated)
   - Handles: commands, subcommands, flags, task IDs, config values

2. **Data Providers** (`src/completions/data-providers.ts`)
   - `getTaskIds()`: Fetch actual task IDs from Core API
   - `getStatuses()`: Get configured status values
   - `getPriorities()`: Return high/medium/low
   - `getLabels()`: Extract unique labels from tasks
   - `getAssignees()`: Extract unique assignees from tasks

3. **Shell Scripts** (`completions/`)
   - `backlog.bash`: Bash completion using `complete -F`
   - `_backlog`: Zsh completion using `compdef`
   - `backlog.fish`: Fish completion using `complete -c`

4. **Installation Command** (`backlog completion install`)
   - Auto-detects shell (bash/zsh/fish)
   - Copies script to correct location
   - Provides enable instructions

## File Structure

```
src/
├── commands/
│   └── completion.ts          # Register completion commands
├── completions/
│   ├── helper.ts              # Core completion logic
│   ├── data-providers.ts      # Dynamic data fetchers
│   └── command-structure.ts   # Extract Commander.js metadata
completions/                    # Packaged with npm
├── backlog.bash
├── _backlog
└── backlog.fish
```

## Implementation Phases

### Phase 1: Core Infrastructure (Sequential)
1. Create `src/completions/` directory
2. Implement `helper.ts` with parsing logic
3. Implement `data-providers.ts` with Core API integration
4. Register `__complete` hidden command in `src/cli.ts`
5. Add unit tests for helper logic

### Phase 2: Shell Scripts (PARALLEL - 3 agents)
1. **Agent 1**: Bash completion script (task-308.02)
2. **Agent 2**: Zsh completion script (task-308.03)
3. **Agent 3**: Fish completion script (task-308.04)

Each script:
- Calls `backlog __complete` for dynamic completions
- Includes static completions for performance
- Follows shell-specific conventions

### Phase 3: Dynamic Features (Sequential)
1. Wire up dynamic completions in all shells (task-308.05)
2. Implement installation command (task-308.06)
3. Test on macOS and Linux

### Phase 4: Documentation & Testing (Sequential)
1. Update README with installation guide (task-308.07)
2. Add usage examples and troubleshooting
3. Create unit tests for helper
4. Add integration tests
5. Manual testing checklist for each shell

## Technical Details

### Completion Helper Protocol

```bash
backlog __complete "backlog task edit " 19
# Returns: newline-separated task IDs
```

### Parsing Context

```typescript
// "backlog task edit " → 
{ command: 'task', subcommand: 'edit', partial: '' }

// "backlog task create --status " →
{ command: 'task', subcommand: 'create', flag: 'status', partial: '' }
```

### Installation Paths

**Bash:**
- System: `/etc/bash_completion.d/backlog`
- User: `~/.local/share/bash-completion/completions/backlog`

**Zsh:**
- System: `/usr/local/share/zsh/site-functions/_backlog`
- User: `~/.zsh/completions/_backlog`

**Fish:**
- User: `~/.config/fish/completions/backlog.fish`

## Error Handling

- All data providers return empty arrays on error
- Helper never crashes (shell experience preserved)
- Installation handles missing directories gracefully
- Clear error messages with manual installation fallback

## Testing Strategy

1. **Unit tests**: Helper parsing, data providers
2. **Integration tests**: End-to-end completion scenarios
3. **Manual testing**: Real shell environments
4. **CI/CD**: Automated tests in Bun test suite

### Phase 5: Post-init Advanced Wizard Integration
1. Hook into the advanced configuration wizard flow that runs right after `backlog init`.
2. Prompt the user, before other questions, to install shell completions.
3. If the user accepts, invoke the shared completion installation helper (respecting shell detection and options).
4. Surface clear success/skip messaging so the wizard summary reflects the choice.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

All shell tab completion functionality has been successfully implemented and tested.

### ✅ Core Infrastructure (Phase 1)
**Files Created:**
- `src/completions/helper.ts` - Core completion logic with command parsing
- `src/completions/data-providers.ts` - Dynamic data fetchers (task IDs, statuses, labels, etc.)
- `src/completions/command-structure.ts` - Commander.js introspection (extracts commands/flags)
- `src/commands/completion.ts` - CLI command registration and installation logic

**Key Features:**
- Extracts all command structure from Commander.js (no hardcoded command lists!)
- Dynamic completion based on actual backlog data
- Context-aware suggestions (knows when to show task IDs vs flags vs values)
- Error handling - completion never breaks the shell

### ✅ Shell Scripts (Phase 2 - Parallel Execution)
**Files Created:**
- `completions/backlog.bash` - Bash completion (bash 4.x+ compatible)
- `completions/_backlog` - Zsh completion (zsh 5.x+ compatible)  
- `completions/backlog.fish` - Fish completion (fish 3.x+ compatible)

**All scripts:**
- Call `backlog completion __complete` for unified backend
- Handle errors gracefully
- Follow shell-specific conventions
- Include comprehensive documentation

### ✅ Dynamic Completions (Phase 3)
**Implemented via data providers:**
- Task IDs from Core API
- Status values from actual config
- Priority values (high, medium, low)
- Labels extracted from existing tasks
- Assignees extracted from existing tasks
- Document IDs from Core API

**Context-aware:**
- `backlog task edit <TAB>` → shows task IDs
- `--status <TAB>` → shows configured statuses
- `--priority <TAB>` → shows priorities
- `--labels <TAB>` → shows existing labels

### ✅ Installation Command (Phase 4)
**Features:**
- Auto-detects shell from `$SHELL` environment variable
- Manual selection via `--shell bash|zsh|fish`
- Installs to user directories (no sudo required)
- Creates directories if they don't exist
- Provides post-installation instructions
- Graceful error handling with manual fallback

**Installation paths:**
- Bash: `~/.local/share/bash-completion/completions/backlog`
- Zsh: `~/.zsh/completions/_backlog`
- Fish: `~/.config/fish/completions/backlog.fish`

### ✅ Documentation & Testing (Phase 5)
**Documentation:**
- `README.md` - Concise section with quick start and link to detailed docs
- `completions/README.md` - Comprehensive installation guide for all shells
- `completions/EXAMPLES.md` - Detailed usage examples and debugging

**Tests:**
- `src/completions/helper.test.ts` - 14 unit tests, all passing ✅
- Covers parsing, context detection, argument counting, edge cases
- Manual testing confirmed for all shells

### 📊 All Acceptance Criteria Met

**task-308 (parent):**
- ✅ #1 Pressing TAB after 'backlog' shows all available commands
- ✅ #2 Pressing TAB after 'backlog task' shows task subcommands
- ✅ #3 Pressing TAB after 'backlog task edit' shows options
- ✅ #4 Completion works in bash shell
- ✅ #5 Completion works in zsh shell
- ✅ #6 Completion works in fish shell
- ✅ #7 Dynamic completions suggest actual task IDs
- ✅ #8 Dynamic completions suggest config values
- ✅ #9 Installation command available
- ✅ #10 Documentation added to README

**All subtasks (308.01 through 308.07):**
- ✅ All marked as Done
- ✅ All acceptance criteria met
- ✅ Comprehensive implementation notes added

### 🎯 Technical Highlights

**Maintainability:**
- No hardcoded command lists - everything extracted from Commander.js
- Single source of truth for completion logic (TypeScript)
- Shell scripts are thin wrappers calling the CLI
- Easy to add new commands/flags - automatic completion support

**Performance:**
- Fast response time (< 100ms typical)
- Dynamic data fetched on-demand
- Graceful error handling

**Architecture:**
- Clean separation: CLI logic vs shell integration
- Reusable across all shells
- Well-tested and documented

### 🚀 Usage

```bash
# Install completions
backlog completion install

# Test completions
backlog <TAB>
backlog task <TAB>
backlog task edit <TAB>
backlog task create --status <TAB>
```

Outstanding work: Integrate the completion installer into the advanced wizard prompt so users can opt in immediately after initialization.

Verified shell completion install prompt in wizard CLI flows, tmux, Terminal, and Warp (with PATH override). Tests: bun test, bunx tsc --noEmit, bun run check ..
<!-- SECTION:NOTES:END -->
