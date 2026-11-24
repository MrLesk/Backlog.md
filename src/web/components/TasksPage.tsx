import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Milestone, Task } from "../../types";
import { collectAvailableLabels } from "../../utils/label-filter.ts";
import { resolveTaskById } from "../../utils/task-id.ts";
import { applyTaskFilters, createTaskSearchIndex } from "../../utils/task-search.ts";
import { isTerminalStatus } from "../../utils/terminal-status.ts";
import { useBrowserAccess } from "../contexts/BrowserAccessContext";
import type { LaneMode } from "../lib/lanes.ts";
import {
	countActiveFilters,
	isFiltered,
	NO_TASK_FILTERS,
	readTaskFilters,
	type TaskPageFilters,
	toTaskFilterOptions,
	writeTaskFilters,
} from "../lib/task-filters.ts";
import { readLaneMode, rememberLaneMode, rememberTaskLayout, type TaskLayout } from "../lib/task-view.ts";
import Board from "./Board";
import CleanupModal from "./CleanupModal";
import { SuccessToast } from "./SuccessToast";
import TaskFilterPanel from "./TaskFilterPanel";
import TaskList from "./TaskList";
import TaskToolbar from "./TaskToolbar";

interface TasksPageProps {
	/** Which layout this route shows: /tasks is the list, /board the board. */
	layout: TaskLayout;
	/** Every task the page can show before its filters. */
	tasks: Task[];
	statuses: string[];
	availableLabels: string[];
	/** The milestone IDs the Milestone filter offers. */
	milestones: string[];
	milestoneEntities: Milestone[];
	archivedMilestones: Milestone[];
	availablePriorities?: string[];
	availableTypes: string[];
	availableProjects: string[];
	isLoading: boolean;
	loadError?: Error | null;
	hideEmptyColumns: boolean;
	dateFormat?: string;
	onEditTask: (task: Task) => void;
	onNewTask: () => void;
	onRefreshData: () => Promise<void>;
	onTasksUpdated: (tasks: Task[], requestTask: Task) => void;
}

const FILTER_PANEL_ID = "task-filters";

/**
 * The assignees the Assignee filter offers. The filter matches a name in any letter case, as the CLI does, so each
 * name is offered once, spelled as the first task that has it spells it.
 */
function collectAssignees(tasks: Task[]): string[] {
	const namesByKey = new Map<string, string>();
	for (const task of tasks) {
		for (const assignee of task.assignee) {
			const name = assignee.trim();
			if (name && !namesByKey.has(name.toLowerCase())) namesByKey.set(name.toLowerCase(), name);
		}
	}
	return [...namesByKey.values()].sort((left, right) => left.localeCompare(right));
}

/**
 * The Tasks page: one set of filters in the URL and two layouts, List (/tasks) and Board (/board), that show the
 * tasks those filters keep. This component owns the filters and the data flow; TaskList shows the tasks, and Board
 * shows them and moves them.
 */
export default function TasksPage({
	layout,
	tasks,
	statuses,
	availableLabels,
	milestones,
	milestoneEntities,
	archivedMilestones,
	availablePriorities,
	availableTypes,
	availableProjects,
	isLoading,
	loadError,
	hideEmptyColumns,
	dateFormat,
	onEditTask,
	onNewTask,
	onRefreshData,
	onTasksUpdated,
}: TasksPageProps) {
	const { canWrite } = useBrowserAccess();
	const [searchParams, setSearchParams] = useSearchParams();
	const choices = useMemo(
		() => ({ statuses, types: availableTypes, projects: availableProjects, priorities: availablePriorities }),
		[statuses, availableTypes, availableProjects, availablePriorities],
	);
	const filters = useMemo(() => readTaskFilters(searchParams, choices), [searchParams, choices]);
	const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
	const [isCleanupOpen, setIsCleanupOpen] = useState(false);
	const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
	const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);

	// Writes only the filters a control changed, so an edit made before the configuration has loaded keeps the
	// values that cannot be resolved yet.
	const changeFilters = useCallback(
		(changes: Partial<TaskPageFilters>) =>
			setSearchParams((params) => writeTaskFilters(params, changes), { replace: true }),
		[setSearchParams],
	);

	// A link written by hand or by an older version gets the configured spelling of its statuses, types, projects and
	// priorities, and type, project and priority values that are not configured leave the URL. This waits for a
	// successful load, or every custom value would look unsupported.
	useEffect(() => {
		if (isLoading || loadError) return;
		const canonical = writeTaskFilters(searchParams, filters);
		if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
	}, [isLoading, loadError, searchParams, filters, setSearchParams]);

	useEffect(() => {
		rememberTaskLayout(layout);
	}, [layout]);

	const laneMode = readLaneMode(searchParams);
	useEffect(() => {
		if (layout === "board") rememberLaneMode(laneMode);
	}, [layout, laneMode]);

	const changeLaneMode = (mode: LaneMode) => {
		// Remembered first: "none" leaves the URL without a lane, and readLaneMode then reads the remembered mode.
		rememberLaneMode(mode);
		setSearchParams(
			(params) => {
				const next = new URLSearchParams(params);
				if (mode === "none") next.delete("lane");
				else next.set("lane", mode);
				return next;
			},
			{ replace: true },
		);
	};

	// A legacy link, /?highlight=<id>, opens that task: the parameter leaves the URL, and the task opens once it is
	// loaded and the page has rendered, as it did on the board.
	useEffect(() => {
		const highlight = searchParams.get("highlight");
		if (!highlight) return;
		setHighlightTaskId(highlight);
		setSearchParams(
			(params) => {
				const next = new URLSearchParams(params);
				next.delete("highlight");
				return next;
			},
			{ replace: true },
		);
	}, [searchParams, setSearchParams]);

	useEffect(() => {
		if (!highlightTaskId || tasks.length === 0) return;
		const resolution = resolveTaskById(tasks, highlightTaskId);
		if (resolution.status !== "found") return;
		const timer = setTimeout(() => {
			setHighlightTaskId(null);
			onEditTask(resolution.task);
		}, 100);
		return () => clearTimeout(timer);
	}, [highlightTaskId, tasks, onEditTask]);

	// The shared task search narrows the tasks once, for whichever layout shows them. Its index is built only while
	// there is text to search for.
	const hasSearchText = filters.search.trim() !== "";
	const searchIndex = useMemo(() => (hasSearchText ? createTaskSearchIndex(tasks) : undefined), [hasSearchText, tasks]);
	const allMilestones = useMemo(
		() => [...milestoneEntities, ...archivedMilestones],
		[milestoneEntities, archivedMilestones],
	);
	// Valid while the browser holds every task. If it holds a part, filter on the server, which runs the same function.
	const visibleTasks = useMemo(
		() => applyTaskFilters(tasks, toTaskFilterOptions(filters, allMilestones), searchIndex),
		[tasks, filters, allMilestones, searchIndex],
	);

	const assignees = useMemo(() => collectAssignees(tasks), [tasks]);
	const labels = useMemo(() => collectAvailableLabels(tasks, availableLabels), [tasks, availableLabels]);
	const hasTasksWithMilestones = useMemo(() => tasks.some((task) => Boolean(task.milestone?.trim())), [tasks]);
	const filtered = isFiltered(filters);
	const showsNoMatches = filtered && !isLoading && visibleTasks.length === 0;

	const openCleanup = canWrite ? () => setIsCleanupOpen(true) : undefined;
	const handleCleanupSuccess = async (message: string) => {
		setIsCleanupOpen(false);
		setCleanupMessage(message);
		await onRefreshData();
		setTimeout(() => setCleanupMessage(null), 4000);
	};

	// From md up the head stays in place and only the tasks below it scroll, so keyboard focus can never sit under it.
	return (
		<div className="md:flex md:h-full md:flex-col">
			<header className="border-b border-line-soft panel-gutter pt-4 pb-3 md:shrink-0">
				<div className="mb-3 flex items-baseline gap-2.5">
					<h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">Tasks</h2>
					{!isLoading && !loadError && (
						<span className="font-mono text-[13px] font-medium text-ink-3">
							{filtered ? `${visibleTasks.length} of ${tasks.length}` : tasks.length}
						</span>
					)}
				</div>
				<TaskToolbar
					layout={layout}
					search={filters.search}
					onSearchChange={(search) => changeFilters({ search })}
					activeFilterCount={countActiveFilters(filters)}
					filterPanelId={FILTER_PANEL_ID}
					isFilterPanelOpen={isFilterPanelOpen}
					onToggleFilterPanel={() => setIsFilterPanelOpen((open) => !open)}
					isFiltered={filtered}
					onClearFilters={() => changeFilters(NO_TASK_FILTERS)}
					laneMode={laneMode}
					onLaneModeChange={changeLaneMode}
					hasTasksWithMilestones={hasTasksWithMilestones}
					onNewTask={canWrite ? onNewTask : undefined}
				/>
				{isFilterPanelOpen && (
					<TaskFilterPanel
						id={FILTER_PANEL_ID}
						filters={filters}
						onChange={changeFilters}
						statuses={statuses}
						assignees={assignees}
						labels={labels}
						types={availableTypes}
						projects={availableProjects}
						priorities={availablePriorities}
						milestones={milestones}
						milestoneEntities={milestoneEntities}
					/>
				)}
			</header>

			{/* Keyed by layout, so each layout starts at the top. */}
			<div key={layout} className="md:min-h-0 md:flex-1 md:overflow-y-auto">
				{loadError ? (
					<div className="panel-gutter py-6">
						<div className="rounded-control border border-line bg-blocked-bg px-6 py-10 text-center" role="alert">
							<p className="font-medium text-blocked">Failed to load tasks</p>
							<p className="mt-1 text-sm text-blocked">{loadError.message}</p>
							<button
								type="button"
								onClick={() => void onRefreshData()}
								className="mt-4 rounded-control bg-blocked px-3 py-1.5 text-sm font-medium text-on-ink transition-opacity duration-200 hover:opacity-90 focus-ring"
							>
								Retry
							</button>
						</div>
					</div>
				) : (
					<>
						{showsNoMatches && (
							<p className="panel-gutter py-10 text-center text-sm text-ink-2">No tasks match these filters</p>
						)}
						{/* Hidden rather than removed while nothing matches, so groups and lanes keep their open state. */}
						<div hidden={showsNoMatches}>
							{layout === "list" ? (
								<TaskList
									tasks={visibleTasks}
									statuses={statuses}
									priorities={availablePriorities}
									projects={availableProjects}
									finalGroupOpenByDefault={filters.statuses.some((status) => isTerminalStatus(status, statuses))}
									isLoading={isLoading}
									dateFormat={dateFormat}
									onEditTask={onEditTask}
									onCleanup={openCleanup}
								/>
							) : (
								<Board
									tasks={tasks}
									visibleTasks={visibleTasks}
									onEditTask={onEditTask}
									onRefreshData={onRefreshData}
									onTasksUpdated={onTasksUpdated}
									statuses={statuses}
									isLoading={isLoading}
									milestoneEntities={milestoneEntities}
									archivedMilestones={archivedMilestones}
									laneMode={laneMode}
									availablePriorities={availablePriorities}
									availableProjects={availableProjects}
									hideEmptyColumns={hideEmptyColumns}
									dateFormat={dateFormat}
									onCleanup={openCleanup}
								/>
							)}
						</div>
					</>
				)}
			</div>

			{canWrite && (
				<CleanupModal
					isOpen={isCleanupOpen}
					onClose={() => setIsCleanupOpen(false)}
					onSuccess={handleCleanupSuccess}
					dateFormat={dateFormat}
				/>
			)}
			{cleanupMessage && (
				<SuccessToast
					message={cleanupMessage}
					onDismiss={() => setCleanupMessage(null)}
					icon={
						<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					}
				/>
			)}
		</div>
	);
}
