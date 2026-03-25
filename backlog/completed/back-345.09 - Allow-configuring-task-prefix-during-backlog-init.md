---
id: BACK-345.09
title: Allow configuring task prefix during backlog init
status: Done
assignee:
  - '@codex'
created_date: '2026-01-05 13:13'
updated_date: '2026-01-05 13:37'
labels:
  - enhancement
  - cli
  - id-generation
dependencies: []
parent_task_id: task-345
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Allow users to configure a custom task prefix (e.g., `JIRA-`, `BUG-`, `ISSUE-`) during `backlog init`. The prefix is **read-only after initial setup** since changing it would break existing task IDs.

### Current Behavior
- `backlog init` creates config with default prefixes: `{ task: "task", draft: "draft" }`
- Prefix is not shown in `backlog config list` or Settings UI
- No way to set custom prefix during init

### Proposed Changes

**1. CLI Init (`src/cli.ts` ~line 289)**
- Add `--task-prefix <prefix>` option
- Add interactive prompt: "Task prefix (default: task):" (first-time init only)
- Validate: letters only (a-z, A-Z)
- Skip prompt on re-initialization (preserve existing)

**2. Core Init (`src/core/init.ts`)**
- Add `taskPrefix?: string` to `InitializeProjectOptions.advancedConfig`
- Add `prefixes` to config construction:
```typescript
prefixes: existingConfig?.prefixes || {
    task: advancedConfig?.taskPrefix || "task",
    draft: "draft",
},
```

**3. Browser Wizard (`src/web/components/InitializationScreen.tsx`)**
- Add `taskPrefix: string` to `AdvancedConfig` interface
- Add input field in Advanced Settings under "ID Formatting"
- Input auto-filters to letters only
- Pass to API in `handleInitialize()`
- Show in summary if customized

**4. Config View - CLI (`src/cli.ts` ~line 2880)**
- Add to `config list` output: `taskPrefix: JIRA (read-only)`
- Show "(read-only)" suffix to indicate it can't be changed

**5. Config View - Web UI (`src/web/components/Settings.tsx`)**
- Add read-only display field for task prefix
- Style as disabled/grayed to indicate not editable

**6. Config Set - Block Changes (`src/cli.ts` ~line 2850)**
- Add case for "taskPrefix" in config set command
- Return error: "Task prefix cannot be changed after initialization"

### Key Files
- `src/cli.ts` - init command, config list, config set
- `src/core/init.ts` - InitializeProjectOptions, config construction
- `src/web/components/InitializationScreen.tsx` - wizard advanced settings
- `src/web/components/Settings.tsx` - read-only display
- `src/test/enhanced-init.test.ts` - tests

### Validation Rules
- Letters only: `/^[a-zA-Z]+$/`
- Cannot be empty (defaults to "task")
- Cannot be changed after first init
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI: `--task-prefix` flag added to init command
- [x] #2 CLI: Interactive prompt asks for prefix during first-time init only
- [x] #3 CLI: `config list` shows taskPrefix with (read-only) suffix
- [x] #4 CLI: `config set taskPrefix` returns error that it cannot be changed
- [x] #5 Browser: Task prefix input in Advanced Settings (ID Formatting section)
- [x] #6 Browser: Settings page shows task prefix as read-only
- [x] #7 Validation: Only letters allowed, reject numbers/special chars
- [x] #8 Re-init: Existing prefix preserved, no prompt shown
- [x] #9 Summary: Shows custom prefix in init summary if not default
- [x] #10 Tests: Cover CLI flag, interactive prompt, browser wizard, config view, validation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Core Changes
1. **`src/core/init.ts`**
   - Add `taskPrefix?: string` to `InitializeProjectOptions.advancedConfig` interface (~line 24)
   - Add `prefixes` field to config construction (~line 110):
     ```typescript
     prefixes: existingConfig?.prefixes || {
         task: advancedConfig?.taskPrefix || "task",
         draft: "draft",
     },
     ```

### Phase 2: CLI Changes
2. **`src/cli.ts` - Init Command (~line 289)**
   - Add option: `.option("--task-prefix <prefix>", "custom task prefix (default: task)")`
   - Add `taskPrefix?: string` to options interface (~line 320)
   - Add to `isNonInteractive` check (~line 377)
   - Add interactive prompt after project name (~line 400):
     ```typescript
     let taskPrefix = options.taskPrefix;
     if (!taskPrefix && !isNonInteractive && !isReInitialization) {
         taskPrefix = await promptText("Task prefix (default: task):");
     }
     if (taskPrefix && !/^[a-zA-Z]+$/.test(taskPrefix)) {
         console.error("Task prefix must contain only letters");
         process.exit(1);
     }
     ```
   - Pass to initializeProject (~line 840): `taskPrefix: taskPrefix || undefined`

3. **`src/cli.ts` - Config List (~line 2880)**
   - Add line: `console.log(\`  taskPrefix: \${config.prefixes?.task || "task"} (read-only)\`);`

4. **`src/cli.ts` - Config Set (~line 2850)**
   - Add case before default:
     ```typescript
     case "taskPrefix":
     case "prefixes":
         console.error("Task prefix cannot be changed after initialization.");
         console.error("The prefix is set during 'backlog init' and is permanent.");
         process.exit(1);
         break;
     ```

### Phase 3: Browser Wizard
5. **`src/web/components/InitializationScreen.tsx`**
   - Add to AdvancedConfig interface (~line 9): `taskPrefix: string;`
   - Add to initial state (~line 38): `taskPrefix: "",`
   - Add input in renderAdvancedConfigStep() after zeroPaddedIds (~line 572):
     ```tsx
     {/* Task Prefix */}
     <div className="mt-4">
         <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
             Task prefix
         </label>
         <input
             type="text"
             value={advancedConfig.taskPrefix}
             onChange={(e) => setAdvancedConfig(prev => ({
                 ...prev,
                 taskPrefix: e.target.value.replace(/[^a-zA-Z]/g, '')
             }))}
             placeholder="task"
             className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg..."
         />
         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
             Letters only. Cannot be changed later. Examples: JIRA, BUG, ISSUE
         </p>
     </div>
     ```
   - Add to handleInitialize advancedConfig (~line 131): `taskPrefix: advancedConfig.taskPrefix || undefined`
   - Add to summary step (~line 675) if prefix is custom

6. **`src/web/components/Settings.tsx`**
   - Add read-only field showing current task prefix
   - Style as disabled/grayed with "(read-only)" label

### Phase 4: Tests
7. **`src/test/enhanced-init.test.ts`**
   - Test: custom prefix via CLI `--task-prefix JIRA`
   - Test: prefix preserved on re-init
   - Test: validation rejects "123" and "task-1"
   - Test: config shows prefix as read-only

### Files Changed
- `src/core/init.ts` - options interface, config construction
- `src/cli.ts` - init options, prompts, config list/set
- `src/web/components/InitializationScreen.tsx` - wizard input
- `src/web/components/Settings.tsx` - read-only display
- `src/test/enhanced-init.test.ts` - test coverage
<!-- SECTION:PLAN:END -->
