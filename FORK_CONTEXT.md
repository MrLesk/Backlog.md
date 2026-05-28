# Fork context — Logan's Backlog.md extension

Este documento es la fuente de verdad para un agente entrando a una sesión nueva en este repo. Léelo completo antes de tocar cualquier cosa.

---

## Qué es este repo

Fork de [MrLesk/Backlog.md](https://github.com/MrLesk/Backlog.md) (base upstream: tag v1.45.1). El fork extiende la herramienta con un sistema de multi-agent workflow: cuando una tarea cambia de estado, el dispatcher dispara automáticamente un agente Claude (coder → reviewer → human review) sin intervención manual.

**Repositorio real:** `D:\1064n\Programacion\claude\Backlog.md` (tiene `.git`)
**CWD de Claude Code:** `D:\1064n\Programacion\claude\Backlog.md with agents` (NO tiene `.git`, no usar para commits)

El binario instalado globalmente como `backlog` en `C:\Users\logan\.bun\bin\backlog.exe` es el fork compilado. Para actualizar tras cambios: `bun run install:local`.

---

## Commits del fork (sobre upstream v1.45.1)

```
32fe7e4 Add watcher-lock compromise regression tests
ee8e7ee Fix browser/watch crash when the watcher lock is compromised
528c949 Add install:local script to build + install the fork over global backlog
490cd85 Make task card fields configurable + add milestone slot
131c860 Make kanban columns configurable (reorder, hide, color)
75c206e Fire onStatusChange on hand edits via the file watcher
498b0cf Harden hook plumbing + browser data flow against live-test regressions
a66a5f2 Add browser UI for onStatusChange + agent prompt scaffold
3bd0184 Add design + four-round review trail for fork roadmap
53ef505 Add Windows shell support to status-change callbacks
```

---

## Features añadidas (resumen por commit)

### 1. Windows shell support (`53ef505`)
`src/utils/status-callback.ts`: añadido `resolveShellInvocation(configShell?)` con auto-detect (sh → sh.exe → cmd.exe fallback en Windows) y soporte explícito de shell (`sh`, `bash`, `cmd`, `pwsh`, `powershell`, path absoluto). `src/types/index.ts`: `BacklogConfig` tiene `shell?: string`. Tests en `src/test/status-callback.test.ts` con `testSh` gate para plataforma.

### 2. Browser UI para onStatusChange + agent prompts (`a66a5f2` + `498b0cf`)
- `src/web/components/Settings.tsx`: sección "Status Change Callback" con textarea para el comando, dropdown de shell con probe de disponibilidad (shells no instalados aparecen anotados y disabled).
- `src/web/components/TaskDetailsModal.tsx`: sección "Advanced" colapsable con override per-task de `onStatusChange`.
- `src/server/index.ts`: endpoint `/api/status` devuelve `statusCallbackCapabilities` (platform, resolvedShell, shellAvailability).
- `backlog/prompts/`: 9 archivos — `code.md`, `review.md`, `ready.md` (prompts reales), `code.test.md`, `review.test.md`, `ready.test.md` (smoke-test no-op), `dispatch.ps1` (Windows), `dispatch.sh` (POSIX), `README.md`.
- `src/web/App.tsx`: WebSocket auto-reconnect con backoff exponencial, `loadAllData` con `showLoading: false` para refrescos en background, generation guard para evitar stale overwrites. Ver `src/web/lib/race-guard.ts`.

### 3. File watcher disparando hooks en hand-edits (`75c206e`)
Tres piezas que trabajan juntas:

**`src/core/task-write-coordinator.ts`** — `createTaskWriteCoordinator()`. Registra el SHA-256 de bytes escritos en-process con `recordWrite(taskId, hash)`. El watcher consume el hash con `consumeMatchingWrite(taskId, hash)`: match = suppression; no match = hand edit → fire. Determinístico, sin time-window.

**`src/core/task-hook-dispatcher.ts`** — `createTaskHookDispatcher(opts)`. Único punto de disparo del hook. Mantiene snapshot de status anterior por task. `onTaskWrite(task, { suppress? })` para el watcher; `dispatchInProcess(args, { suppress? })` para paths in-process. `seedSnapshot(tasks)` on initial load. `forgetTask(taskId)` on deletion. `reset()` on project reinit.

**`src/core/watcher-lock.ts`** — `acquireWatcherLock(backlogDir, opts)`. Lock exclusivo en `<backlogDir>/.locks/watcher` vía `proper-lockfile`. Solo un proceso por proyecto puede ser el "watcher authority". `onCompromised` swallows en vez de crashear (`staleMs: 30_000`, `updateMs: 8_000`).

**Integración:**
- `src/core/backlog.ts`: `Core` construye coordinator + dispatcher en el constructor. `dispatchHookInProcess` resuelve hook-authority lazily (probe del lock). `setHookDispatchAuthority(value)` para server/watch que ya saben su resultado del lock. Generation guard en `resolveHookAuthority` para no leakear el lock del proyecto viejo tras `reinitializeProjectRoot`.
- `src/core/content-store.ts`: `patchFilesystem` registra hash pre-write via `onSerialized` callback de `saveTask`. El watcher hashea lo que leyó y pasa `suppress` al dispatcher.
- `src/file-system/operations.ts`: `saveTask` acepta `opts.onSerialized({ filePath, content, taskId })` que se llama ANTES del `Bun.write` — cierra la race window.
- `src/server/index.ts`: intenta `acquireWatcherLock` en startup; si falla (otro proceso lo tiene), llama `core.setEnableWatchers(false)` y `core.setHookDispatchAuthority(false)`.
- `src/cli.ts`: nuevo comando `backlog watch` — adquiere lock, instala watcher, log de cada hook a stdout, `core.setHookDispatchAuthority(true)` explícito.

**Diagrama de flujo:**
```
Hand-edit o API write
         │
         ▼
  ¿onSerialized?
  (saveTask via ContentStore wrapper)
         │ sí → recordWrite(taskId, sha256(content)) ANTES del Bun.write
         │
         ▼
    Bun.write(content)
         │
         ▼ (async, ms después)
  fs.watch detecta cambio
         │
         ▼
  watcher: consumeMatchingWrite?
   sí → onTaskWrite(task, { suppress: true })   ← in-process: snapshot actualiza, no fire
    no → onTaskWrite(task, { suppress: false })  ← hand edit: fire si transición
         │
         ▼
  ¿isAuthority?
   sí → executeStatusCallback(...)
    no → skip (el otro proceso con el lock lo dispatcha vía su watcher)
```

### 4. Columnas de kanban configurables (`131c860`)
**Config:** `board?: BoardConfig` en `BacklogConfig`. `BoardConfig = { columns?: BoardColumnConfig[]; card?: CardConfig }`. `BoardColumnConfig = { status: string; color?: string }`. El parser usa `gray-matter` (scoped al bloque `board:`) para YAML nested. Contratos: `board.columns === undefined` = fallback a todos los statuses; `board.columns === []` = hide-all explícito (preservado en disco).

**Resolver:** `src/utils/resolve-board-config.ts` — `resolveBoardColumns(config)` filtra stale entries, dedupe, respeta `[]` sin revertir al default.

**UI:**
- `Board.tsx`: `boardColumns?: BoardColumnConfig[]` prop. `visibleColumns` via useMemo; `realTerminalStatus = getTerminalStatus(statuses)` (no el visible subset). Cleanup affordance anchored en real terminal status; en milestone mode solo el primer lane con terminal tasks recibe `onCleanup`.
- `TaskColumn.tsx`: `accentColor?: string` → colored dot antes del título.
- `Settings.tsx`: sección "Board Columns" con `BoardColumnsSection` — drag handle + botones ▲/▼ (keyboard accessible), checkbox Show, color picker. `buildBoardEditorRows(statuses, board)` helper puro en `src/utils/build-board-editor-rows.ts` para que `board.columns === []` (hide-all) se muestre correctamente al recargar (el bug era usar `length > 0` en vez de `!== undefined`).

**Merge helpers:** `src/utils/board-config-merge.ts` — `mergeBoardWithColumns` y `mergeBoardWithCard` para preservar el sibling al editar uno solo.

### 5. Campos de task card configurables + milestone slot (`490cd85`)
**Tipos:** `CONFIGURABLE_CARD_FIELDS = ["id","priority","milestone","labels","createdDate","assignee"]` + `ConfigurableCardField` + `CardConfig = { hide?: ConfigurableCardField[] }` en `src/types/index.ts`.

**TaskCard.tsx:** prop `hiddenFields?: ReadonlySet<ConfigurableCardField>`. Cada slot tiene `hiddenFields.has(field)`. Chrome always-on: title, branch banner, priority border accent, drag visuals. Nuevo slot "milestone" en el body above labels (pill stone-colored con flag icon, solo cuando `task.milestone` es non-empty y no hidden).

**Resolver:** `src/utils/resolve-card-config.ts` — `resolveCardHiddenFields(config): ReadonlySet<ConfigurableCardField>`.

**Settings.tsx:** sección "Card Fields" con `CardFieldsSection` — checkbox por field. Ambas secciones usan `mergeBoardWith*` para preservar el sibling.

### 6. Bugfixes post-implementación
**`ee8e7ee` — ECOMPROMISED crash fix:**
- `src/core/watcher-lock.ts`: `onCompromised` non-throwing que loguea + flipea flag `compromised`. `isCompromised()` en `WatcherLockHolder`. `release()` es no-op en compromised (proper-lockfile tiraría ERELEASED). Defaults subidos a 30s/8s para sobrevivir startup pesado en Windows.

**`498b0cf` — Browser UI hardening:**
- WebSocket auto-reconnect con backoff (1s → 15s) + `refreshData()` al reconectar.
- `loadAllData({ showLoading: false })` para refrescos background (no blinking sidebar).
- Generation counter en `loadAllData` descarta responses out-of-order.
- Hook fire-and-forget en `Core.updateTaskFromInput` para no bloquear la respuesta HTTP.

---

## Archivos nuevos del fork (no existían en upstream)

```
src/core/task-hook-dispatcher.ts      — dispatcher único de onStatusChange
src/core/task-write-coordinator.ts    — coordinador hash-based de escrituras
src/core/watcher-lock.ts              — lockfile exclusivo del watcher
src/utils/resolve-board-config.ts     — resolveBoardColumns()
src/utils/resolve-card-config.ts      — resolveCardHiddenFields()
src/utils/build-board-editor-rows.ts  — buildBoardEditorRows() pure helper
src/utils/board-config-merge.ts       — mergeBoardWith*() helpers
src/web/lib/race-guard.ts             — createGenerationGate(), trackSpinner()
backlog/prompts/code.md               — prompt coder agent (real)
backlog/prompts/review.md             — prompt reviewer agent (real)
backlog/prompts/ready.md              — prompt notifier Human Review (real)
backlog/prompts/code.test.md          — smoke-test: espera 5s → In Review
backlog/prompts/review.test.md        — smoke-test: espera 5s → Human Review
backlog/prompts/ready.test.md         — smoke-test: espera 5s → log
backlog/prompts/dispatch.ps1          — dispatcher Windows PowerShell
backlog/prompts/dispatch.sh           — dispatcher POSIX
backlog/prompts/README.md             — instrucciones de instalación
scripts/install-local.sh              — build + instala binario global
```

Tests nuevos:
```
src/test/status-callback.test.ts      — extendido con shell resolver + probe
src/test/task-write-coordinator.test.ts
src/test/task-hook-dispatcher.test.ts
src/test/watcher-lock.test.ts
src/test/race-guard.test.ts
src/test/save-task-on-serialized.test.ts
src/test/core-reinit-hook-authority.test.ts
src/test/dispatch-ps1.test.ts         — tests del dispatcher.ps1 en Windows
src/test/board-config-roundtrip.test.ts
src/test/resolve-board-config.test.ts
src/test/build-board-editor-rows.test.ts
src/test/board-config-merge.test.ts
src/test/resolve-card-config.test.ts
src/test/web-task-card-fields.test.tsx — render-level con jsdom + react-dom
```

---

## Cómo correr el fork en desarrollo

```bash
# Dev server (source, sin compilar):
bun run cli browser --port 6421

# Smoke-test del loop de agentes (no gasta tokens):
BACKLOG_DISPATCH_MODE=test bun run cli browser --port 6421

# Build + instalar globalmente:
bun run install:local

# Tests del fork (suite completa relevante):
bun test src/test/task-write-coordinator.test.ts \
         src/test/task-hook-dispatcher.test.ts \
         src/test/watcher-lock.test.ts \
         src/test/race-guard.test.ts \
         src/test/status-callback.test.ts \
         src/test/save-task-on-serialized.test.ts \
         src/test/core-reinit-hook-authority.test.ts \
         src/test/board-config-roundtrip.test.ts \
         src/test/resolve-board-config.test.ts \
         src/test/build-board-editor-rows.test.ts \
         src/test/board-config-merge.test.ts \
         src/test/resolve-card-config.test.ts \
         src/test/web-task-card-fields.test.tsx

# Type check:
bunx tsc --noEmit
```

**Nota Windows:** La suite completa (`bun test`) tiene ~488 fallos pre-existentes en el upstream por `git init -b main` que requiere Git ≥ 2.28. Los fallos del fork son solo los tests de arriba — todos deben pasar.

---

## Configuración del proyecto real (para usar el loop)

En `backlog/config.yml` del proyecto donde corres los agentes:

```yaml
statuses: ["To Do", "In Progress", "In Review", "Human Review", "Done"]
shell: "powershell"
onStatusChange: 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PWD\backlog\prompts\dispatch.ps1"'
```

Para POSIX:
```yaml
shell: "sh"
onStatusChange: '"$PWD/backlog/prompts/dispatch.sh"'
```

Copia los prompts desde el fork:
```bash
xcopy /E /I "D:\1064n\Programacion\claude\Backlog.md\backlog\prompts" ".\backlog\prompts"
```

El agente coder leerá la tarea por MCP, implementará, moverá a "In Review". El reviewer auditará el diff y moverá a "Human Review" (ok) o "In Progress" (rework). Edita `code.md`, `review.md`, `ready.md` con las convenciones de tu proyecto.

Variables de entorno de control:
- `BACKLOG_DISPATCH_MODE=test` — usa prompts smoke-test en vez de los reales (no gasta tokens)
- `BACKLOG_DISPATCH_DRY_RUN=1` — el dispatcher escribe el `.prompt` pero no lanza claude

---

## MCP

El MCP server del fork está registrado a nivel usuario:
```
backlog: backlog mcp start — ✓ Connected
```

Los agentes lo usan para leer y editar tareas. Para re-registrar si se rompe:
```bash
claude mcp remove backlog --scope user
claude mcp add backlog --scope user -- backlog mcp start
```

---

## Deuda técnica conocida

1. **`BACK-466` (borrado del backlog upstream):** Tests de regresión para la race condition de `loadAllData`, WS reconnect, y el dispatcher PowerShell. Los tests del dispatcher (`dispatch-ps1.test.ts`) ejercitan el path real de stdin. Los de race condition están cubiertos por `race-guard.test.ts`. El gap documentado en `review-7.md`.

2. **Flake ~10% en suite combinada** — `save-task-on-serialized.test.ts > supports async onSerialized callbacks` falla ocasionalmente en Windows por contención de fs cuando otros tests también escriben. En aislamiento pasa siempre. No introducido por el fork — es latencia de flush de Bun.write en Windows.

3. **Tests de `Board.tsx` sin cobertura de `cleanupLaneKey`** — la lógica de deduplicar el cleanup en milestone mode es un branch inline pequeño. Refactorizar a helper puro lo haría testeable. Documentado en `review-14.md`.

4. **`CardFieldsSection` y `BoardColumnsSection` sin tests de React** — los helpers puros (`buildBoardEditorRows`, `mergeBoardWith*`) sí están testeados, pero el wiring de estado dentro del componente no. El gap es aceptable por la cobertura de los helpers. Documentado en `review-16.md`.

---

## Review history

Cada feature pasó por rondas de revisión hasta APPROVE:

| Rondas | Feature |
|--------|---------|
| review.md → review-4.md | Diseño de las 5 tasks (4 rondas, pre-implementación) |
| review-5.md → review-7.md | Task #2 browser UI + hook hardening (3 rondas, APPROVE round 7) |
| review-8.md → review-11.md | Task #3 file watcher (4 rondas, APPROVE round 11) |
| review-12.md → review-14.md | Task #4 columnas configurables (3 rondas, APPROVE round 14) |
| review-15.md → review-16.md | Task #5 card fields (2 rondas, APPROVE round 16) |

Los archivos `review-N.md` en la raíz son el historial completo.

---

## Qué sigue / ideas pendientes

El roadmap original de 5 tasks está completo. Ideas para iteraciones futuras:

- **Notificaciones externas en `ready.md`** — el prompt actual solo loguea; extender para Slack/email/webhook cuando una tarea llega a "Human Review".
- **`backlog watch` como servicio de Windows** — NSSM o Task Scheduler para mantener el watcher activo sin terminal abierta.
- **Board columns en el TUI** — el kanban del TUI (`board.ts`) sigue usando `config.statuses` directamente, ignorando `board.columns`. Consistencia con el browser.
- **Métricas de ciclo** — tiempo promedio coder→reviewer, número de rework rounds, por tarea/sprint. Los logs del dispatcher ya tienen los timestamps.
- **Configuración de `card.hide` en el TUI** — `TaskCard.tsx` es el componente web; el TUI tiene su propia vista de tarea en `board.ts`/`src/tui/`.
- **Subir version de package.json** — actualmente sigue en `1.45.1` (upstream). Un bump a `1.46.0` o `2.0.0` diferenciaría el fork en `backlog --version`.
