# 测试耗时瓶颈分析报告

测量时间：2026-06-25
运行环境：Linux 5.15.0-179-generic，bun v1.3.10

---

## 总览

| 指标 | 数值 |
|------|------|
| 总耗时（并行运行） | 291.23s |
| 总测试数 | 1337 |
| 总测试文件数 | 165（发现 152 个 .test.ts + 其他） |
| 失败用例数 | 2 |
| 跳过用例数 | 2 |
| 逐文件顺序运行总耗时（累加） | 303536ms（≈304s） |

**关键发现**：并行运行耗时（291s）与逐文件串行累加耗时（304s）几乎相等（比值约 1.04x），说明测试文件之间**几乎没有并行化收益**。根本原因是各测试文件内部大量串行地启动 `bun` 子进程执行 CLI，这些子进程调用占满了 CPU，无法从并行化中获益。

---

## Top 10 最慢测试文件

数据来源：对每个测试文件独立计时（`date +%s%3N` 包裹 `bun test <file>`），共 152 个文件，按耗时降序排列。

| 排名 | 文件 | 耗时 (ms) | 用例数 | `bun` 子进程调用数 | ms/子进程 |
|------|------|-----------|--------|--------------------|----------|
| 1 | src/test/cli.test.ts | 44407 | 90 | 79 | ~562 |
| 2 | src/test/cli-priority-filtering.test.ts | 35794 | 11 | 13 | —（含 2 个 5s 超时） |
| 3 | src/test/acceptance-criteria.test.ts | 24069 | 32 | 40 | ~601 |
| 4 | src/test/cli-milestone-management.test.ts | 17744 | 10 | 30 | ~591 |
| 5 | src/test/task-edit-preservation.test.ts | 13428 | 6 | 24 | ~559 |
| 6 | src/test/cli-refs-docs.test.ts | 12398 | 16 | 21 | ~590 |
| 7 | src/test/cli-init-no-git.test.ts | 5659 | 4 | 9 | ~629 |
| 8 | src/test/cli-doc-search.test.ts | 5202 | 5 | 10 | ~520 |
| 9 | src/test/definition-of-done-cli.test.ts | 5167 | 5 | 9 | ~574 |
| 10 | src/test/cli-task-milestone.test.ts | 4764 | 4 | 8 | ~596 |

**Top 10 文件合计耗时**：168632ms（占全量串行总耗时 55.5%）

---

## 慢文件详情

以下为对 Top 5 慢文件分别独立执行 `bun test <file>` 的实测结果。

### 1. src/test/cli.test.ts

```
Ran 90 tests across 1 file. [44.65s]
90 pass / 0 fail
```

每测试平均耗时：~493ms。文件中有 79 处 `` $`bun ${CLI_PATH} ...` `` 调用，每次调用需冷启动一个完整的 bun 进程执行 CLI 命令。

### 2. src/test/cli-priority-filtering.test.ts

```
(fail) CLI Priority Filtering > task list --priority high shows only high priority tasks [5000.83ms]
(fail) CLI Priority Filtering > case insensitive priority filtering [5000.23ms]
Ran 11 tests across 1 file. [36.76s]
9 pass / 2 fail
```

该文件 11 个用例中有 2 个因 5000ms 超时而失败（合计浪费 ~10s）。超时原因：测试使用 `bun run cli` 而非直接调用 CLI 路径，且测试没有隔离的测试目录，直接在项目工作区执行（可能因加载大量任务文件而超时）。

### 3. src/test/acceptance-criteria.test.ts

```
Ran 32 tests across 1 file. [23.92s]
32 pass / 0 fail
```

每测试平均耗时：~748ms。包含 40 处 `bun` 子进程调用，多个测试在临时目录中多次调用 CLI（create + edit + view）构成多步 CLI 交互场景。

### 4. src/test/cli-milestone-management.test.ts

```
Ran 10 tests across 1 file. [16.96s]
10 pass / 0 fail
```

每测试平均耗时：~1697ms，每个 `bun` 子进程调用约 565ms。该文件每个测试用例平均包含 3 个串行 CLI 子进程调用。

### 5. src/test/task-edit-preservation.test.ts

```
Ran 6 tests across 1 file. [14.16s]
6 pass / 0 fail
```

每测试平均耗时：~2360ms，仅 6 个测试但每个测试包含约 4 次串行 CLI 子进程调用。说明 `bun` 启动开销是主要瓶颈而非测试逻辑本身。

---

## 瓶颈归因

### 主要瓶颈：`bun` 子进程冷启动（占主导地位）

**实测证据**：
- Top 10 慢文件中有 10 个文件使用 `` $`bun ${CLI_PATH} ...` `` 模式
- 每次 `bun` 子进程调用耗时约 **520~630ms**（跨多个文件测量一致）
- 全测试套件中共有 **363 个 `bun` 子进程调用**（grep `` $`bun `` 统计）
- 估算 `bun` 启动开销总计：363 × ~580ms ≈ **210s**，占全套测试 291s 的 **72%**

每次 `bun` 启动都需要：bun 运行时初始化 → TypeScript 转译 → 模块加载 → CLI 入口执行，即使 CLI 命令本身只需几毫秒。

### 次要瓶颈：Git 子进程开销

**实测证据**：
- 全测试套件中有 **375 个 `git` 子进程调用**（`$`git `` 统计）
- 涉及 git 操作的测试文件（如 mcp-milestones.test.ts：3566ms、symlink-backlog-root.test.ts：3545ms）明显慢于不涉及文件 I/O 的单元测试
- 每个测试用例在 beforeEach 中执行 `git init + git config + git add + git commit` 等多步操作

### 次要瓶颈：测试超时导致的时间浪费

**实测证据**：
- `cli-priority-filtering.test.ts` 中 2 个测试各超时 5000ms，共浪费 **10秒**
- `cli-doc-search.test.ts` 有 1 个测试超时（full run 中出现 `[2904.82ms]` fail）
- 超时根因：测试使用 `bun run cli`（通过 package.json scripts 调用）而非直接 `bun ${CLI_PATH}`，增加了额外的 npm scripts 解析层，且在项目工作区运行而非隔离目录，扫描了真实的 backlog 文件

### 次要瓶颈：测试并行度不足

**实测证据**：
- 并行运行总耗时 291s，逐文件串行总耗时 304s，并行加速比仅 1.04x
- bun test 默认按文件并行，但各文件内的 `bun` 子进程调用串行执行
- 由于每个测试都在 beforeEach/afterEach 中创建和清理临时目录，文件间缺乏共享 fixture

---

## 优化建议

### 1. 用进程内 API 调用替换 CLI 子进程（优先级：高，预期收益最大）

**针对**：所有 363 个 `` $`bun ${CLI_PATH} ...` `` 调用。

**方案**：将 CLI 集成测试改为通过 `Core` 或命令函数的进程内调用，而非 fork 子进程。已有 `initializeTestProject` 等工具函数，可扩展为直接调用命令处理函数。

**预期收益**：消除每次 ~580ms 的 bun 启动开销，估算可节省 **200s+**（约 70% 加速）。

**注意事项**：需区分"验证 CLI 输出格式"的测试（必须走真实 CLI 子进程）与"验证业务逻辑"的测试（可改为进程内）。

### 2. 修复超时测试（优先级：高，成本低）

**针对**：`cli-priority-filtering.test.ts`（2个超时）、`cli-doc-search.test.ts`（1个超时）。

**方案**：
- 将 `bun run cli task list ...` 改为 `` bun ${CLI_PATH} task list ... ``，跳过 npm scripts 解析层
- 在 beforeEach 中创建隔离的临时目录并初始化空的 backlog，避免扫描项目实际任务文件
- 或将超时阈值适当调整（当前默认 5000ms 在低性能环境下过紧）

**预期收益**：恢复 2 个失败用例，节省 ~10s 超时浪费时间。

### 3. 共享 Git 仓库 Fixture（优先级：中）

**针对**：在 beforeEach 中执行 `git init + commit` 的测试文件（mcp-milestones、symlink-backlog-root 等）。

**方案**：在 `describe` 级别的 `beforeAll` 中一次性创建 git 仓库 fixture，各测试通过复制（`cp -r`）或 worktree 机制获得隔离副本，而非每次重新 `git init`。

**预期收益**：减少 375 个 git 子进程中属于 setup 的部分，预计节省 20-30s。

### 4. 增加文件级并行度（优先级：中）

**方案**：将当前的大测试文件（如 cli.test.ts 的 90 个测试）按功能域拆分为更小的文件，使 bun test 的文件级并行调度器能更好地分发到多核。

**预期收益**：在多核环境下，将部分串行变为并行，可减少 wall-clock 时间。单独实施效果有限，需与方案 1 配合。

### 5. 引入 bun test --timeout 全局配置（优先级：低）

**方案**：在 `bunfig.toml` 中设置合理的全局超时值（如 10000ms），为慢速 CI 环境提供更宽松的阈值，同时通过监控超时报警来持续追踪性能退化。

**预期收益**：减少因环境差异导致的偶发超时失败，不改善总体耗时。

---

*报告基于 2026-06-25 实测数据生成，源数据文件：`/tmp/ttb-back511/raw-test-output.txt`、`/tmp/ttb-back511/slow-files.txt`、`/tmp/ttb-back511/per-file-timing.txt`。*
