import type { Milestone } from "../../types";
import { getPriorityOptions } from "../../utils/priority-config.ts";
import { NO_MILESTONE, type TaskPageFilters, UNASSIGNED } from "../lib/task-filters.ts";
import { getMilestoneLabel } from "../utils/milestones";
import LabelFilterDropdown from "./LabelFilterDropdown";

interface TaskFilterPanelProps {
	id: string;
	filters: TaskPageFilters;
	onChange: (filters: TaskPageFilters) => void;
	statuses: string[];
	assignees: string[];
	labels: string[];
	types: string[];
	/** The configured projects. Without any, the Project filter is not offered. */
	projects: string[];
	priorities?: string[];
	/** Milestone IDs to offer, named through `milestoneEntities`. */
	milestones: string[];
	milestoneEntities: Milestone[];
}

const SELECT_CLASS =
	"h-8 w-full min-w-0 rounded-control border border-line bg-surface px-2 text-sm text-ink transition-colors duration-200 hover:bg-hover focus-ring md:w-auto";
const DROPDOWN_CLASS = "w-full md:w-auto md:min-w-[11rem]";

/** The filters of the Tasks page. Every change goes to the URL through `onChange`, so both layouts follow it. */
export default function TaskFilterPanel({
	id,
	filters,
	onChange,
	statuses,
	assignees,
	labels,
	types,
	projects,
	priorities,
	milestones,
	milestoneEntities,
}: TaskFilterPanelProps) {
	const change = (update: Partial<TaskPageFilters>) => onChange({ ...filters, ...update });
	// A link may spell the assignee in another letter case than the option that selects the same tasks.
	const assigneeOption =
		assignees.find((name) => name.toLowerCase() === filters.assignee.toLowerCase()) ?? filters.assignee;

	return (
		<div id={id} className="grid grid-cols-1 gap-2 pt-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
			<LabelFilterDropdown
				availableLabels={statuses}
				selectedLabels={filters.statuses}
				onChange={(next) => change({ statuses: next })}
				menuId={`${id}-status`}
				label="Status"
				emptyLabel="All"
				noOptionsLabel="No statuses"
				clearLabel="Clear status filter"
				className={DROPDOWN_CLASS}
			/>
			<LabelFilterDropdown
				availableLabels={statuses}
				selectedLabels={filters.excludedStatuses}
				onChange={(next) => change({ excludedStatuses: next })}
				menuId={`${id}-exclude-status`}
				label="Exclude status"
				emptyLabel="None"
				noOptionsLabel="No statuses"
				clearLabel="Clear excluded statuses"
				className={DROPDOWN_CLASS}
			/>
			<select
				aria-label="Filter by assignee"
				value={assigneeOption}
				onChange={(event) => change({ assignee: event.target.value })}
				className={SELECT_CLASS}
			>
				<option value="">All assignees</option>
				<option value={UNASSIGNED}>Unassigned</option>
				{assignees.map((assignee) => (
					<option key={assignee} value={assignee}>
						{assignee}
					</option>
				))}
			</select>
			<LabelFilterDropdown
				availableLabels={labels}
				selectedLabels={filters.labels}
				onChange={(next) => change({ labels: next })}
				menuId={`${id}-labels`}
				className={DROPDOWN_CLASS}
			/>
			<select
				aria-label="Filter by type"
				value={filters.type}
				onChange={(event) => change({ type: event.target.value })}
				className={SELECT_CLASS}
			>
				<option value="">All types</option>
				{types.map((type) => (
					<option key={type} value={type}>
						{type}
					</option>
				))}
			</select>
			{projects.length > 0 && (
				<select
					aria-label="Filter by project"
					value={filters.project}
					onChange={(event) => change({ project: event.target.value })}
					className={SELECT_CLASS}
				>
					<option value="">All projects</option>
					{projects.map((project) => (
						<option key={project} value={project}>
							{project}
						</option>
					))}
				</select>
			)}
			<select
				aria-label="Filter by priority"
				value={filters.priority}
				onChange={(event) => change({ priority: event.target.value })}
				className={SELECT_CLASS}
			>
				<option value="">All priorities</option>
				{getPriorityOptions(priorities).map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			<select
				aria-label="Filter by milestone"
				value={filters.milestone}
				onChange={(event) => change({ milestone: event.target.value })}
				className={SELECT_CLASS}
			>
				<option value="">All milestones</option>
				<option value={NO_MILESTONE}>No milestone</option>
				{milestones.map((milestone) => (
					<option key={milestone} value={milestone}>
						{getMilestoneLabel(milestone, milestoneEntities)}
					</option>
				))}
			</select>
		</div>
	);
}
