import type { Milestone } from "../../types";
import { getPriorityOptions } from "../../utils/priority-config.ts";
import { NO_MILESTONE, type TaskPageFilters, UNASSIGNED } from "../lib/task-filters.ts";
import { getMilestoneLabel } from "../utils/milestones";
import LabelFilterDropdown from "./LabelFilterDropdown";

interface TaskFilterPanelProps {
	id: string;
	filters: TaskPageFilters;
	/** Receives only the filters a control changed. */
	onChange: (changes: Partial<TaskPageFilters>) => void;
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

const DROPDOWN_CLASS = "w-full md:w-auto md:min-w-[11rem]";

interface FilterSelectProps {
	/** The name shown on the control, as on the dropdown buttons beside it. */
	name: string;
	/** The accessible name of the select, such as "Filter by assignee". */
	label: string;
	value: string;
	/** The choices after "All", which keeps every task. */
	options: Array<{ value: string; label: string }>;
	onChange: (value: string) => void;
}

/**
 * A select drawn like the dropdown buttons beside it: the filter's name on the left and its choice on the right,
 * "All" when there is none. The native select lies over the whole control, invisible, so a click anywhere opens
 * it and the keyboard and screen readers reach it as usual.
 */
function FilterSelect({ name, label, value, options, onChange }: FilterSelectProps) {
	// A value from a link that no option offers is still shown as it is.
	const choice = value === "" ? "All" : (options.find((option) => option.value === value)?.label ?? value);
	// The keyboard focus ring of the select is drawn on this control. Its color is set before focus, as in the
	// focus-ring utility, so transition-colors cannot fade the ring in.
	return (
		<div
			className={`${DROPDOWN_CLASS} relative flex h-8 items-center justify-between gap-2 rounded-control border border-line bg-surface px-2.5 text-sm text-ink outline-accent-strong transition-colors duration-200 hover:bg-hover has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2`}
		>
			<span aria-hidden="true">{name}</span>
			<span aria-hidden="true" className="truncate text-xs text-ink-3">
				{choice}
			</span>
			<select
				aria-label={label}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="absolute inset-0 cursor-pointer opacity-0"
			>
				<option value="">All</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	);
}

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
	// A link may spell the assignee in another letter case than the option that selects the same tasks.
	const assigneeOption =
		assignees.find((name) => name.toLowerCase() === filters.assignee.toLowerCase()) ?? filters.assignee;
	const valuesAsOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

	return (
		<div id={id} className="grid grid-cols-1 gap-2 pt-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
			<LabelFilterDropdown
				availableLabels={statuses}
				selectedLabels={filters.statuses}
				onChange={(next) => onChange({ statuses: next })}
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
				onChange={(next) => onChange({ excludedStatuses: next })}
				menuId={`${id}-exclude-status`}
				label="Exclude status"
				emptyLabel="None"
				noOptionsLabel="No statuses"
				clearLabel="Clear excluded statuses"
				className={DROPDOWN_CLASS}
			/>
			<FilterSelect
				name="Assignee"
				label="Filter by assignee"
				value={assigneeOption}
				options={[{ value: UNASSIGNED, label: "Unassigned" }, ...valuesAsOptions(assignees)]}
				onChange={(assignee) => onChange({ assignee })}
			/>
			<LabelFilterDropdown
				availableLabels={labels}
				selectedLabels={filters.labels}
				onChange={(next) => onChange({ labels: next })}
				menuId={`${id}-labels`}
				className={DROPDOWN_CLASS}
			/>
			<FilterSelect
				name="Type"
				label="Filter by type"
				value={filters.type}
				options={valuesAsOptions(types)}
				onChange={(type) => onChange({ type })}
			/>
			{projects.length > 0 && (
				<FilterSelect
					name="Project"
					label="Filter by project"
					value={filters.project}
					options={valuesAsOptions(projects)}
					onChange={(project) => onChange({ project })}
				/>
			)}
			<FilterSelect
				name="Priority"
				label="Filter by priority"
				value={filters.priority}
				options={getPriorityOptions(priorities)}
				onChange={(priority) => onChange({ priority })}
			/>
			<FilterSelect
				name="Milestone"
				label="Filter by milestone"
				value={filters.milestone}
				options={[
					{ value: NO_MILESTONE, label: "No milestone" },
					...milestones.map((milestone) => ({ value: milestone, label: getMilestoneLabel(milestone, milestoneEntities) })),
				]}
				onChange={(milestone) => onChange({ milestone })}
			/>
		</div>
	);
}
