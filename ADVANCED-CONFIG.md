# Advanced Configuration

For getting started and the interactive wizard overview, see [README.md](README.md#-configuration).

## Configuration Commands

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| View all configs | `backlog config list` |
| Get specific config | `backlog config get defaultEditor` |
| Set config value | `backlog config set defaultEditor "code --wait"` |
| Enable auto-commit | `backlog config set autoCommit true` |
| Bypass git hooks | `backlog config set bypassGitHooks true` |
| Enable cross-branch check | `backlog config set checkActiveBranches true` |
| Set active branch days | `backlog config set activeBranchDays 30` |

Running `backlog config` with no arguments launches the interactive advanced wizard, including guided Definition of Done defaults editing (add/remove/reorder/clear).

## Available Configuration Options

| Key               | Purpose            | Default                       |
|-------------------|--------------------|-------------------------------|
| `defaultAssignee` | Pre-fill assignee  | `[]`                          |
| `defaultStatus`   | First column       | `To Do`                       |
| `definition_of_done` | Default DoD checklist items for new tasks | `(not set)` |
| `statuses`        | Board columns      | `[To Do, In Progress, Done]`  |
| `dateFormat`      | Date/time format   | `yyyy-mm-dd hh:mm`            |
| `includeDatetimeInDates` | Add time to new dates | `true`              |
| `defaultEditor`   | Editor for 'E' key | Platform default (nano/notepad) |
| `defaultPort`     | Web UI port        | `6420`                        |
| `autoOpenBrowser` | Open browser automatically | `true`            |
| `remoteOperations`| Enable remote git operations | `true`           |
| `autoCommit`      | Automatically commit task changes | `false`       |
| `bypassGitHooks`  | Skip git hooks when committing (uses --no-verify) | `false`       |
| `zeroPaddedIds`   | Pad all IDs (tasks, docs, etc.) with leading zeros | `(disabled)`  |
| `checkActiveBranches` | Check task states across active branches for accuracy | `true` |
| `activeBranchDays` | How many days a branch is considered active | `30` |
| `onStatusChange`  | Shell command to run on status change | `(disabled)` |

## Detailed Notes

> Editor setup guide: See [Configuring VIM and Neovim as Default Editor](backlog/docs/doc-002%20-%20Configuring-VIM-and-Neovim-as-Default-Editor.md) for configuration tips and troubleshooting interactive editors.

> **Note**: Set `remoteOperations: false` to work offline. This disables git fetch operations and loads tasks from local branches only, useful when working without network connectivity.

> **Git Control**: By default, `autoCommit` is set to `false`, giving you full control over your git history. Task operations will modify files but won't automatically commit changes. Set `autoCommit: true` if you prefer automatic commits for each task operation.

> **Git Hooks**: If you have pre-commit hooks (like conventional commits or linters) that interfere with backlog.md's automated commits, set `bypassGitHooks: true` to skip them using the `--no-verify` flag.

> **Performance**: Cross-branch checking ensures accurate task tracking across all active branches but may impact performance on large repositories. You can disable it by setting `checkActiveBranches: false` for maximum speed, or adjust `activeBranchDays` to control how far back to look for branch activity (lower values = better performance).

> **Status Change Callbacks**: Set `onStatusChange` to run a shell command whenever a task's status changes. Available variables: `$TASK_ID`, `$OLD_STATUS`, `$NEW_STATUS`, `$TASK_TITLE`. Per-task override via `onStatusChange` in task frontmatter. Example: `'if [ "$NEW_STATUS" = "In Progress" ]; then claude "Task $TASK_ID ($TASK_TITLE) has been assigned to you. Please implement it." & fi'`

> **Date/Time Support**: Backlog.md now supports datetime precision for all dates. New items automatically include time (YYYY-MM-DD HH:mm format in UTC), while existing date-only entries remain unchanged for backward compatibility. Use the migration script `bun src/scripts/migrate-dates.ts` to optionally add time to existing items.
