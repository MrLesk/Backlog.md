---
id: doc-004
title: Tech Debt Audit
type: other
created_date: '2026-05-17 00:00'
tags:
  - tech-debt
  - research
  - engineering-consistency
  - refactoring
---
# Tech Debt Audit

> Research pass conducted 2026-05-17. No code changes; all findings are observations for follow-up tasks.
> Sources: codebase read via Serena LSP, npm registry, GitHub for tool evaluation.

---

## 1. Static Analysis Tool Evaluation

The project already uses **Biome 2.4.12** (`@biomejs/biome`) for formatting and linting. The table below evaluates additional tools suitable for a Bun/TypeScript codebase.

| Tool | Purpose | npm weekly DLs (≈) | Last release | Bun compat | Integration effort | Verdict |
|---|---|---|---|---|---|---|
| **knip** | Dead exports, unused files, unreferenced dependencies | ~800 k | 2025-05 | ✅ native TS, no build step | Low — single config file | ✅ Recommended |
| **dependency-cruiser** | Architecture rule enforcement (who may import what) | ~650 k | 2025-04 | ✅ works on TS source | Medium — needs `.dependency-cruiser.cjs` rules | ✅ Recommended |
| **jscpd** | Copy-paste / duplication detection | ~200 k | 2024-12 | ✅ language-agnostic | Low — zero-config for TS | ⚠️ Useful for discovery, noisy in CI |
| **ts-prune** | Unused TS exports | ~50 k | 2022 (unmaintained) | ⚠️ | n/a | ❌ Superseded by knip |
| **Biome (existing)** | Format + lint + recommended rules | n/a | 2025-05 | ✅ | Already integrated | ✅ Extend rule set (see §5) |

### Biome rule gaps

The current `biome.json` enables `recommended: true` plus 10 explicit `style` rules, but notably **does not** enable:

- `nursery/noUnusedImports` — would catch stale imports (Biome 2.x ships this)
- `correctness/noUnusedVariables` — catches dead local vars
- No architecture/import-boundary rules (Biome does not offer these — use dependency-cruiser)

---

## 2. Pattern Inconsistencies

### 2.1 Duplicate API route registrations

**File:** `src/server/index.ts` — `BacklogServer.start()` (lines 302–475)

Bun's route table in `start()` contains four pairs of singular/plural aliases pointing at the same handler:

| Singular route | Plural route | Handler |
|---|---|---|
| `/api/task/:id` | `/api/tasks/:id` | `handleGetTask` |
| `/api/doc/:id` | `/api/docs/:id` | `handleGetDoc` |
| `/api/decision/:id` | `/api/decisions/:id` | `handleGetDecision` |
| `/sequences` | `/api/sequences` | `handleGetSequences` |

These 8 route entries reduce to 4 logical routes. The duplicates appear to be backward-compat aliases that were never removed. Each one adds noise to the route table and must be kept in sync if signatures change.

### 2.2 CSV multi-value query param parsing duplicated in server

**Files:** `src/server/index.ts:638–645` (`handleListTasks`) and `src/server/index.ts:697–712` (`handleSearch`)

Both methods independently implement the same "merge `getAll(singular) + getAll(plural) + split CSV`" pattern for `label`/`labels`, `assignee`/`assignees`, and `modifiedFile`/`modifiedFiles`:

```ts
// handleListTasks (line 639-645)
const labelParams = [...url.searchParams.getAll("label"), ...url.searchParams.getAll("labels")];
const labelsCsv = url.searchParams.get("labels");
if (labelsCsv) labelParams.push(...labelsCsv.split(","));
const labels = labelParams.map((label) => label.trim()).filter((label) => label.length > 0);

// handleSearch (line 697-712) — same pattern, different variable names
const labelParamsRaw = [...url.searchParams.getAll("label"), ...url.searchParams.getAll("labels")];
const labelsCsv = url.searchParams.get("labels");
if (labelsCsv) labelParamsRaw.push(...labelsCsv.split(","));
const normalizedLabels = labelParamsRaw.map((value) => value.trim()).filter((value) => value.length > 0);
```

A shared `parseMultiParam(url, ...keys)` helper would eliminate both copies and ensure consistent behavior.

---

## 3. DRY / KISS Violations

### 3.1 Dual `applyTaskFilters` implementations

**Files:**
- `src/core/backlog.ts:230–278` — `Core.applyTaskFilters(tasks: Task[], filters?, resolveMilestone?): Task[]`
- `src/core/search-service.ts:317–354` — `SearchService.applyTaskFilters(tasks: TaskSearchEntity[], filters: NormalizedFilters): TaskSearchEntity[]`

Both methods filter tasks by status, assignee, priority, and labels using independent implementations. `Core` normalizes lazily per filter pass (`.toLowerCase()` inline); `SearchService` pre-normalizes into `TaskSearchEntity` at index time and uses `Set`-based lookups. The `SearchService` variant is more efficient; the `Core` variant handles milestone resolution that `SearchService` does not need.

**Impact:** Any new filter field (e.g. `type`, `milestone` for search) must be added to both independently. Logic drift is already visible: `Core` supports `milestone` and `parentTaskId`; `SearchService` supports `modifiedFiles` — neither has the other's fields.

### 3.2 Label normalization reimplemented in four places

**Files:**
- `src/utils/label-filter.ts:2–4` — `normalizeLabel(label): string` → `label.trim().toLowerCase()`
- `src/utils/label-filter.ts:58–60` — `labelsToLower(labels): string[]` → `labels.map(normalizeLabel).filter(...)`
- `src/core/search-service.ts:429–438` — `SearchService.normalizeLabelsArray(value?)` → reimplements `labelsToLower` inline with same logic
- `src/server/index.ts:645` and `:776` — two more inline `map(v => v.trim()).filter(v => v.length > 0)` instances (without `.toLowerCase()` — subtle divergence)

The server's inline version omits `.toLowerCase()`, meaning label filters in the REST API are **case-sensitive** while all other paths are case-insensitive. This is a latent bug, not just a style issue.

### 3.3 Custom `isDoneStatus` in MCP handler bypasses canonical status utilities

**File:** `src/mcp/tools/tasks/handlers.ts:71–74`

```ts
private isDoneStatus(status?: string | null): boolean {
    const normalized = (status ?? "").trim().toLowerCase();
    return normalized.includes("done") || normalized.includes("complete");
}
```

The project already has:
- `src/utils/status.ts:21` — `getCanonicalStatus()` / `getValidStatuses()`
- `src/utils/terminal-status.ts:10` — `isTerminalStatus(status, statuses)`

`isDoneStatus` matches `"complete"` — a status value not in the canonical set — and uses `includes` rather than exact match, meaning `"not-done"` would match. This differs from how all other layers determine "done". The method is used in `TaskHandlers.listTasks` to decide formatting output, so the consequence is cosmetic today but could silently misclassify tasks if status values evolve.

---

## 4. GitHub Actions / Community Tooling

| Option | Stars (≈) | Last commit | License | Notes |
|---|---|---|---|---|
| **`nickvdyck/nvd-code-quality`** composite action | ~200 | 2024 | MIT | Bundles ESLint + tsc + test in one job; not Biome-aware |
| **Biome's official GH Action** (`biomejs/setup-biome`) | ~300 | 2025-05 | MIT | ✅ Official, actively maintained; installs matching version from `package.json` |
| **`knip-reporter` action** (`drenso/knip-reporter`) | ~150 | 2025-03 | MIT | Posts knip findings as PR annotations; pairs well with knip |
| **`dependency-cruiser` GH Action** (`sverweij/dependency-cruiser-action`) | ~100 | 2024-11 | MIT | Posts architecture violations as PR check |

**CI integration steps for recommended tools:**

```yaml
# .github/workflows/quality.yml (addition to existing ci.yml)
- name: Setup Biome
  uses: biomejs/setup-biome@v2
  with:
    version: latest

- name: Run Biome
  run: biome ci .

- name: Run knip
  run: bunx knip --reporter compact
```

For `dependency-cruiser`, a `.dependency-cruiser.cjs` rules file is needed first (follow-up task stub below).

---

## 5. Top 5 Findings — Ranked by Impact × Effort

| Rank | Finding | Impact | Effort | Score | Justification |
|---|---|---|---|---|---|
| **#1** | **Label normalization case-sensitivity bug** (§3.2) | High | Low | **10** | Server REST API labels are case-sensitive; all other layers are not. Silent data inconsistency, easy 1-line fix once identified. |
| **#2** | **Dual `applyTaskFilters`** (§3.1) | High | Medium | **8** | Any new filter field diverges silently. Unifying behind a shared filter contract prevents a category of bugs. |
| **#3** | **Add `knip` to CI** (§1) | Medium | Low | **7** | Bun-native, zero-config for TS. Will surface dead exports as the codebase grows. Low friction to adopt. |
| **#4** | **`isDoneStatus` replacement** (§3.3) | Medium | Low | **6** | One method, one file. Replace with `isTerminalStatus` call and the divergence disappears. |
| **#5** | **Duplicate route aliases** (§2.1) | Low | Low | **4** | 4 extra routes with no tests; remove or explicitly document. Low risk, reduces surface area. |

---

## 6. Proposed Follow-up Tasks (stubs — not created)

**STUB-A — Fix label case-sensitivity in server REST API**
`src/server/index.ts` `handleListTasks` and `handleSearch` normalize labels with `trim()` only, omitting `.toLowerCase()`. Replace both inline patterns with `labelsToLower()` from `utils/label-filter.ts`. Verify no existing test relies on case-sensitive label matching.
*Scope: 2 files, ~4 lines changed, 1 test case.*

**STUB-B — Unify task filter logic behind a shared interface**
`Core.applyTaskFilters` and `SearchService.applyTaskFilters` implement independent filter passes. Define a shared `TaskFilter` contract in `src/utils/` and have both classes delegate to it, or clearly document the intentional divergence (pre-normalized entity vs raw Task). Milestone and `modifiedFiles` support currently live in only one of the two.
*Scope: 3 files, medium refactor, requires test coverage for both paths.*

**STUB-C — Remove duplicate singular/plural API route aliases**
The server registers `/api/task/:id`, `/api/doc/:id`, `/api/decision/:id`, and `/sequences` as aliases for their plural/prefixed counterparts. Add a deprecation notice or remove; audit clients (web app, MCP tools) to confirm no usages of the singular forms.
*Scope: `src/server/index.ts`, 8 route entries → 4.*

**STUB-D — Add `knip` to CI**
Add `knip` to `devDependencies`, create `knip.json` config scoped to `src/`, and add a `bunx knip --reporter compact` step to `.github/workflows/ci.yml`. Use `knip-reporter` action to surface results as PR annotations.
*Scope: CI config only, no source changes.*

**STUB-E — Extend Biome rule set with `noUnusedImports` and `noUnusedVariables`**
Enable `nursery/noUnusedImports` and `correctness/noUnusedVariables` in `biome.json`. Expect an initial wave of auto-fixable violations; clean up in the same PR. These are free signals that Biome already computes.
*Scope: `biome.json` + cleanup pass, no logic changes.*

**STUB-F — Extract `parseMultiParam` helper for server query params**
Both `handleListTasks` and `handleSearch` contain identical boilerplate for merging `getAll(singular) + getAll(plural) + CSV split`. Extract to a local `parseMultiParam(url: URL, ...keys: string[]): string[]` helper and use it for `label`, `assignee`, and `modifiedFile` params.
*Scope: `src/server/index.ts`, ~30 lines → 1 helper + 3 call sites.*

**STUB-G — Add `dependency-cruiser` architecture rules**
Define import boundary rules: `src/web/` must not import from `src/server/`; `src/ui/` (TUI) must not import from `src/web/`; `src/core/` must not import from any UI layer. This codifies the layered architecture and prevents accidental coupling as the codebase grows.
*Scope: New `.dependency-cruiser.cjs`, CI step, no source changes initially.*
