import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LaneMode } from "../lib/lanes.ts";
import { TASK_LAYOUT_PATHS, type TaskLayout } from "../lib/task-view.ts";

interface TaskToolbarProps {
	layout: TaskLayout;
	search: string;
	onSearchChange: (search: string) => void;
	/** How many filters of the Filter panel are set. */
	activeFilterCount: number;
	filterPanelId: string;
	isFilterPanelOpen: boolean;
	onToggleFilterPanel: () => void;
	/** True while the search or a filter narrows the tasks; Clear filters shows only then. */
	isFiltered: boolean;
	onClearFilters: () => void;
	laneMode: LaneMode;
	onLaneModeChange: (mode: LaneMode) => void;
	/** Milestone lanes need at least one task with a milestone. */
	hasTasksWithMilestones: boolean;
	/** Absent without write access. */
	onNewTask?: () => void;
}

const QUIET_BUTTON_CLASS =
	"inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-control px-2.5 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-hover hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

const LAYOUT_LINKS: Array<{ layout: TaskLayout; label: string; icon: string }> = [
	{ layout: "list", label: "List", icon: "M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" },
	{ layout: "board", label: "Board", icon: "M2.5 3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zM9.5 3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z" },
];

function ToolbarIcon({ path }: { path: string }) {
	return (
		<svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden="true">
			<path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/**
 * The controls of the Tasks page: the layout switch, the search, the Filter button, Clear filters, the board's
 * Milestone lanes toggle and New task. It holds no state; TasksPage owns the URL they change.
 */
export default function TaskToolbar({
	layout,
	search,
	onSearchChange,
	activeFilterCount,
	filterPanelId,
	isFilterPanelOpen,
	onToggleFilterPanel,
	isFiltered,
	onClearFilters,
	laneMode,
	onLaneModeChange,
	hasTasksWithMilestones,
	onNewTask,
}: TaskToolbarProps) {
	// The switch keeps the query string, so the filters and the search stay applied in the other layout.
	const { search: query } = useLocation();
	const filterButtonRef = useRef<HTMLButtonElement>(null);

	return (
		<div className="flex flex-wrap items-center gap-2">
			<nav aria-label="Layout" className="inline-flex gap-0.5 rounded-[9px] bg-surface-2 p-0.5">
				{LAYOUT_LINKS.map((link) => {
					const isCurrent = link.layout === layout;
					return (
						<Link
							key={link.layout}
							to={{ pathname: TASK_LAYOUT_PATHS[link.layout], search: query }}
							aria-current={isCurrent ? "page" : undefined}
							className={`flex h-[26px] items-center gap-1.5 rounded-[7px] px-2.5 text-sm font-medium transition-colors duration-200 focus-ring ${
								isCurrent ? "bg-surface text-ink ring-1 ring-line" : "text-ink-2 hover:text-ink"
							}`}
						>
							<ToolbarIcon path={link.icon} />
							{link.label}
						</Link>
					);
				})}
			</nav>

			<label className="order-3 flex h-8 w-full items-center gap-2 rounded-control border border-line bg-surface px-2.5 text-ink-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-strong md:order-none md:ml-auto md:w-60">
				<ToolbarIcon path="M11.2 11.2 14 14M12.25 7a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0z" />
				<input
					type="search"
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder="Search tasks"
					aria-label="Search tasks"
					className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
				/>
			</label>

			<div className="order-4 flex flex-wrap items-center gap-1 md:order-none">
				<button
					ref={filterButtonRef}
					type="button"
					aria-expanded={isFilterPanelOpen}
					aria-controls={filterPanelId}
					onClick={onToggleFilterPanel}
					className={`${QUIET_BUTTON_CLASS} ${isFilterPanelOpen ? "bg-surface-2 text-ink" : ""}`}
				>
					<ToolbarIcon path="M2.5 3.5h11L9.5 8.4V12l-3 1.5V8.4z" />
					Filter
					{activeFilterCount > 0 && (
						<span className="font-mono text-xs text-ink">
							{activeFilterCount}
							<span className="sr-only"> active</span>
						</span>
					)}
				</button>
				{isFiltered && (
					<button
						type="button"
						onClick={() => {
							onClearFilters();
							// The button goes away with the filters, so keyboard focus moves to Filter instead of being lost.
							filterButtonRef.current?.focus();
						}}
						className={QUIET_BUTTON_CLASS}
					>
						Clear filters
					</button>
				)}
				{layout === "board" && (
					<button
						type="button"
						aria-pressed={laneMode === "milestone"}
						disabled={!hasTasksWithMilestones}
						title={hasTasksWithMilestones ? undefined : "No tasks have milestones. Assign milestones to tasks first."}
						onClick={() => onLaneModeChange(laneMode === "milestone" ? "none" : "milestone")}
						className={`${QUIET_BUTTON_CLASS} ${laneMode === "milestone" ? "bg-surface-2 text-ink" : ""}`}
					>
						<ToolbarIcon path="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
						Milestone lanes
					</button>
				)}
			</div>

			{onNewTask && (
				<button
					type="button"
					onClick={onNewTask}
					className="order-2 ml-auto inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-control bg-ink px-3 text-sm font-medium text-on-ink transition-opacity duration-200 hover:opacity-90 focus-ring md:order-none md:ml-0"
				>
					<ToolbarIcon path="M8 3.5v9M3.5 8h9" />
					New task
				</button>
			)}
		</div>
	);
}
