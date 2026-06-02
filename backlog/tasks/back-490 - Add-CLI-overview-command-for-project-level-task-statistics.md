---
id: BACK-490
title: Add CLI overview command for project-level task statistics
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-26 10:07'
updated_date: '2026-05-26 18:06'
labels:
  - feature
  - cli
dependencies:
  - BACK-489
references:
  - >-
    backlog/wiki_output/reports/community-driven-feature-enhancement-recommendations.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enhance the existing `backlog overview` CLI command with a `--plain` output mode, providing project-level task statistics to help users quickly understand project health and task distribution without launching the interactive TUI.

**Key statistics to include:**
- Total task count
- Tasks grouped by status
- Tasks grouped by priority
- Overdue task count (tasks with dueDate in the past)
- At-risk task count (tasks with dueDate today or tomorrow)
- Stale task count (tasks without dueDate, not updated for 30+ days)
- Blocked task count (tasks with unmet dependencies)
- Completion percentage
- Draft count
- Recent activity (created/updated in last 7 days)
- Average task age

**Output formats:**
- Default (`backlog overview`): interactive colored TUI
- `--plain`: plain text output without colors, suitable for piping

This command is a pure read-only operation, reusing existing `core.loadAllTasksForStatistics()` and `getTaskStatistics()` from BACK-489.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `backlog overview --plain` outputs a plain text overview showing: total tasks, completion percentage, draft count, by-status counts, by-priority counts, recent activity, and project health with task lists
- [x] #2 `backlog overview` (default) outputs an interactive colored TUI with the same information, using terminal-native scrolling
- [x] #3 Health indicator labels match the Web UI:
  - `At Risk Tasks: (due soon, require immediate attention)`
  - `Overdue Tasks: (passed the due date)`
  - `Stale Tasks: (No updates for 30+ days, no due date set)`
  - `Blocked Tasks: (waiting on dependencies)`
- [x] #4 Separator style: major sections use `====` (plain: title-length), subsections use `----` (title-length)
- [x] #5 `--plain` flag outputs no ANSI colors, suitable for piping to other commands
- [x] #6 Health indicators (overdue, at-risk, stale, blocked) reuse the logic in `src/core/statistics.ts` (BACK-489)
- [x] #7 The interactive TUI displays at-risk, overdue, stale, and blocked tasks in the Project Health section
- [x] #8 Recent activity section lists recently created and recently updated tasks
- [x] #9 Command is covered by unit and integration tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Files added
- `src/test/stats-command.test.ts` — Tests for `overview --plain`

### Files modified
- `src/commands/overview.ts` — Added `OverviewOptions` interface (`--plain` only); skips loading screen in non-TUI mode to keep stdout clean for piping
- `src/ui/overview-tui.ts` —
  - Rewrote TUI from blessed scrollable-box to ANSI-colored direct terminal output for reliable scrolling (especially in VS Code integrated terminal)
  - Added `renderStatsPlainText()` export for `--plain` rendering
  - Updated TUI Project Health section to display **At Risk**, **Overdue**, **Stale**, and **Blocked** tasks with descriptive labels matching the Web UI
  - Plain text output mirrors TUI structure: Status → Priority → Recent Activity → Project Health (last)
  - Separator rules: `====` under major headings, `----` under subheadings; plain version uses title-length rules
- `src/cli.ts` — Added `--plain` option to the existing `overview` command; removed the temporary `stats` command registration; removed `--json` option
- `src/core/statistics.ts` — Fixed blocked-task detection bug where dependency IDs were compared case-sensitively (`task-1` vs `TASK-1`). Now uses `taskIdsEqual()` for robust comparison. Added `recentlyUpdated` fallback to `createdDate` when `updatedDate` is absent.

### Output structure (plain)
```
Project Name - Project Overview
===============================

Status Overview
===============
  To Do: N tasks (N%)
  In Progress: N tasks (N%)
  Done: N tasks (N%)

  Total Tasks: N
  Completion: N%

Priority Breakdown
==================
  high     N  N%
  medium   N  N%
  low      N  N%
  none     N  N%

Recent Activity
===============
Recently Created
----------------
  TASK-N - Title

Recently Updated
----------------
  TASK-N - Title

Project Health
==============
  Average Task Age: N days
  At Risk: N   Overdue: N   Stale: N   Blocked: N

At Risk Tasks: (due soon, require immediate attention)
------------------------------------------------------
  TASK-N - Title

Overdue Tasks: (passed the due date)
------------------------------------
  TASK-N - Title

Stale Tasks: (No updates for 30+ days, no due date set)
--------------------------------------------------------
  TASK-N - Title

Blocked Tasks: (waiting on dependencies)
----------------------------------------
  TASK-N - Title
```

### Key design decisions
- Reused existing `core.loadAllTasksForStatistics()` and `getTaskStatistics()` from BACK-489 instead of duplicating logic
- Removed `--json` support because the raw `TaskStatistics` output (containing full Task objects) was too verbose for CLI use; plain + TUI covers the user need
- TUI uses direct ANSI color output instead of blessed boxes to avoid scroll/resize bugs in Windows and VS Code terminals
- Kept the command purely read-only — no data model changes
- Blocked-task bug fix was necessary because `core.createTask` normalizes IDs to uppercase in storage, but dependency arrays retain the original case
<!-- SECTION:NOTES:END -->

## Final Result

<!-- SECTION:FINAL:BEGIN -->
`backlog overview` 命令已成功增强，支持两种输出模式：

```bash
backlog overview              # 交互式彩色 TUI（终端原生滚动）
backlog overview --plain      # 纯文本输出（无颜色，适合管道处理）
```

**输出维度**（与 Web Statistics 页面对齐）：
- 总任务数、完成百分比、草稿数
- 按状态分布 + 百分比
- 按优先级分布 + 百分比
- 最近活动：最近创建和更新的任务列表
- 项目健康度：平均任务年龄、临期任务列表、逾期任务列表、停滞任务列表、阻塞任务列表

**TUI 特性**：
- 单列垂直布局，终端原生滚动条/鼠标滚轮直接浏览
- 彩色分区：状态、优先级、活动、健康度
- 健康度提示文案与 Web UI 完全一致

**测试覆盖**：
- CLI 集成测试（`--plain`、ANSI 转义码排除）
- `getTaskStatistics` 单元测试（复用已有测试 + 新增 blocked 逻辑验证）

**附带修复**：
- `src/core/statistics.ts` 中的阻塞任务检测现在正确处理大小写差异（`task-1` vs `TASK-1`）
- `recentlyUpdated` 在缺少 `updatedDate` 时回退到 `createdDate`
<!-- SECTION:FINAL:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
