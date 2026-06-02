---
id: BACK-489
title: >-
  Refactor project health indicators to support at-risk, overdue, and stale
  categories with dueDate awareness
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-26 01:42'
updated_date: '2026-05-26 08:29'
labels:
  - web-ui
dependencies:
  - BACK-401
references:
  - >-
    backlog/tasks/back-401 -
    Add-dueDate-plannedStart-and-plannedEnd-support-for-tasks-and-milestones-across-CLI-TUI-Web-and-MCP.md
priority: medium
ordinal: 34400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After BACK-401 introduced `dueDate`, `plannedStart`, and `plannedEnd` support, the existing project health indicator ("Stale Tasks >30 days") is no longer sufficient. Tasks with a deadline need separate risk categories from tasks without one.

Introduce three distinct project health categories:

1. **At Risk (临期)** — Tasks with a `dueDate` that is **today or tomorrow**.
2. **Overdue (逾期)** — Tasks with a `dueDate` that has **already passed**.
3. **Stale (停滞)** — Tasks **without a `dueDate`** that have not been updated for **30+ days**.

Tasks with a `dueDate` must **no longer** be counted as "stale" to avoid double-classification. The existing `blockedTasks` category remains unchanged.

Color coding is applied at two levels:
- **Top-right summary dots** — amber 🟡 / red 🔴 / blue 🔵 dots next to counters in the statistics header.
- **Task card left border** — a colored left edge on kanban cards for quick visual scanning (amber for at-risk, red for overdue).

All UI text and tooltips must be fully internationalized across 4 languages (en, ja, zh-CN, zh-TW) without mixing languages in a single tooltip.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `statistics.ts` computes `atRiskTasks`, `overdueTasks`, and `staleTasks` correctly:
  - `atRiskTasks` — non-Done tasks with `dueDate` due **today or tomorrow** (`diffDays <= 1`).
  - `overdueTasks` — non-Done tasks with `dueDate` earlier than today.
  - `staleTasks` — non-Done tasks **without** `dueDate`, last updated >30 days ago.
- [x] #2 Tasks that have a `dueDate` are **excluded** from `staleTasks` regardless of update date.
- [x] #3 Web UI statistics page displays the three health counters with colored dots in the header:
  - 🟡 `{n} At Risk` / `{n} 个临期` / `{n} 個臨期` / `{n} 件要注意`
  - 🔴 `{n} Overdue` / `{n} 个逾期` / `{n} 個逾期` / `{n} 件期限超過`
  - 🔵 `{n} Stale` / `{n} 个停滞` / `{n} 個停滯` / `{n} 件停滞`
- [x] #4 Hover tooltips show **single-language** descriptions:
  - **en**: "Due soon, requires immediate attention" / "Past the due date" / "No updates for 30+ days, no due date set"
  - **zh-CN**: "即将截止，需立即处理" / "已过截止日期" / "超过30天未更新、无明确截止日期"
  - **zh-TW**: "即將截止，需立即處理" / "已過截止日期" / "超過30天未更新、無明確截止日期"
  - **ja**: "期限が近づいています。直ちに対応が必要です。" / "期限を過ぎています。" / "30日以上更新がなく、期限が設定されていません。"
- [x] #5 Kanban task cards render a colored left border for at-risk (amber) and overdue (red) tasks.
- [x] #6 i18n keys are added to all 4 locale files (`en.ts`, `ja.ts`, `zh-CN.ts`, `zh-TW.ts`) and type-checked.
- [x] #7 The existing "stale tasks" detail section in the statistics page is updated to reflect the new "Stale" definition (no due date).
- [x] #8 At-risk and overdue task cards in the health section display **dueDate** instead of updated date.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Files modified
- `src/core/statistics.ts` — Added `atRiskTasks` and `overdueTasks` arrays; narrowed `staleTasks` to exclude tasks with `dueDate`.
- `src/web/components/Statistics.tsx` — Updated `projectHealth` rendering to show three colored counters; modified `TaskPreview` to support `showDate: 'dueDate'`; at-risk and overdue cards now display dueDate.
- `src/web/components/TaskCard.tsx` — Added `dueDateRiskClass` computation for colored left-border on at-risk/overdue cards.
- `src/web/locales/{en,ja,zh-CN,zh-TW}.ts` — Added keys:
  - `statistics.atRiskCount`, `statistics.overdueCount`
  - `statistics.atRiskTooltip`, `statistics.overdueTooltip`, `statistics.staleTooltip`
  - `statistics.atRiskTasksTitle`, `statistics.atRiskTasksDesc`, `statistics.moreAtRiskTasks`
  - `statistics.overdueTasksTitle`, `statistics.overdueTasksDesc`, `statistics.moreOverdueTasks`
  - `common.dueBy` (for dueDate labels in task cards)
- `src/test/statistics.test.ts` — Added 4 new test cases covering at-risk, overdue, stale exclusion, and done-task exclusion.

### Logic reference
```
atRisk  = task.status !== "Done"
          && task.dueDate
          && diffInDays(task.dueDate, today) <= 1

overdue = task.status !== "Done"
          && task.dueDate
          && diffInDays(task.dueDate, today) < 0

stale   = task.status !== "Done"
          && !task.dueDate
          && lastUpdated > 30 days ago
```

### Color tokens (Tailwind)
- At Risk: `text-amber-500` / `border-l-amber-500`
- Overdue: `text-red-600` / `border-l-red-500`
- Stale: `text-slate-400`

### Naming lock
- 临期 → `At Risk`
- 逾期 → `Overdue`
- 停滞 → `Stale`

![](/assets/paste/0ca49969-1353-4303-820c-ea85df1cba65.png)
<!-- SECTION:NOTES:END -->

## Final Result

<!-- SECTION:FINAL:BEGIN -->
项目健康度区域成功重构为三种风险分类：

**右上角统计摘要**
- 🟡 **临期**（At Risk）— 有 `dueDate` 且今天或明天截止的任务
- 🔴 **逾期**（Overdue）— 有 `dueDate` 且已过截止日期的任务
- 🔵 **停滞**（Stale）— 无 `dueDate` 且超过 30 天未更新的任务
- 🔴 **阻塞**（Blocked）— 依赖未完成的任务（保持不变）

**详情列表**
- 临期和逾期任务卡片展示 **截止日期**（截止至 / Due by / 期限）而非更新日期
- 停滞任务卡片继续展示 **更新日期**
- 所有任务保持点击编辑行为

**任务卡片视觉标识**
- 临期卡片：左侧琥珀色边条 `border-l-amber-500`
- 逾期卡片：左侧红色边条 `border-l-red-500`

**i18n**
- 4 语言完整覆盖（en / ja / zh-CN / zh-TW）
- 悬停 tooltip 单语言显示，不混排

> 最终效果截图：`backlog/assets/BACK-489-final-result.png`
<!-- SECTION:FINAL:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes when TypeScript touched
- [x] #2 `bun run check .` passes when formatting / linting touched
- [x] #3 `bun test` (or scoped test) passes
<!-- DOD:END -->
