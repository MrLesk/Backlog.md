import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Board from './Board';
import { type Milestone, type Task } from '../../types';
import { resolvePriorityValue } from '../../utils/priority-config';
import { resolveTaskTypeValue } from '../../utils/task-type-config';
import { type LaneMode } from '../lib/lanes';

interface BoardPageProps {
	onEditTask: (task: Task) => void;
	onNewTask: () => void;
	tasks: Task[];
	onRefreshData?: () => Promise<void>;
	statuses: string[];
	milestones: string[];
	availableLabels: string[];
	milestoneEntities: Milestone[];
	archivedMilestones: Milestone[];
	isLoading: boolean;
	hideEmptyColumns?: boolean;
	dateFormat?: string;
	availablePriorities?: string[];
	availableTypes?: string[];
}

export default function BoardPage({
	onEditTask,
	onNewTask,
	tasks,
	onRefreshData,
	statuses,
	milestones,
	availableLabels,
	milestoneEntities,
	archivedMilestones,
	isLoading,
	hideEmptyColumns,
	dateFormat,
	availablePriorities,
	availableTypes,
}: BoardPageProps) {
	const [searchParams, setSearchParams] = useSearchParams();
	const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
	const [laneMode, setLaneMode] = useState<LaneMode>('none');
	const [milestoneFilter, setMilestoneFilter] = useState<string | null>(null);
	const laneStorageKey = 'backlog.board.lane';

	useEffect(() => {
		const storedLane = typeof window !== 'undefined' ? window.localStorage.getItem(laneStorageKey) : null;
		const paramLane = searchParams.get('lane');
		const paramMilestone = searchParams.get('milestone');
		const parseLane = (value: string | null): LaneMode | null => {
			if (value === 'milestone') return 'milestone';
			if (value === 'none') return 'none';
			return null;
		};
		const nextLane = parseLane(paramLane) ?? parseLane(storedLane) ?? 'none';
		setLaneMode((current) => (current === nextLane ? current : nextLane));
		setMilestoneFilter(paramMilestone);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(laneStorageKey, nextLane);
		}
	}, [searchParams]);

	useEffect(() => {
		const highlight = searchParams.get('highlight');
		if (highlight) {
			setHighlightTaskId(highlight);
			// Clear the highlight parameter after setting it
			setSearchParams(params => {
				params.delete('highlight');
				return params;
			}, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	// Clear highlight after it's been used
	const handleEditTask = (task: Task) => {
		setHighlightTaskId(null); // Clear highlight so popup doesn't reopen
		onEditTask(task);
	};

	const handleLaneChange = (mode: LaneMode) => {
		setLaneMode(mode);
		setMilestoneFilter(null); // Clear milestone filter when switching lane modes
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(laneStorageKey, mode);
		}
		setSearchParams(params => {
			if (mode === 'none') {
				params.delete('lane');
			} else {
				params.set('lane', mode);
			}
			params.delete('milestone'); // Clear milestone param when switching
			return params;
		}, { replace: true });
	};

	const handleFiltersChange = (filters: { assignee: string; labels: string[]; priority: string; taskType: string }) => {
		setSearchParams(params => {
			if (filters.assignee) {
				params.set('assignee', filters.assignee);
			} else {
				params.delete('assignee');
			}
			params.delete('label');
			params.delete('labels');
			for (const label of filters.labels) {
				const normalized = label.trim();
				if (normalized) {
					params.append('label', normalized);
				}
			}
			if (filters.priority) {
				params.set('priority', filters.priority);
			} else {
				params.delete('priority');
			}
			if (filters.taskType) {
				params.set('type', filters.taskType);
			} else {
				params.delete('type');
			}
			return params;
		}, { replace: true });
	};

	const filterAssignee = searchParams.get('assignee') ?? '';
	const filterLabels = [
		...searchParams.getAll('label'),
		...searchParams.getAll('labels').flatMap((value) => value.split(',')),
	].map((label) => label.trim()).filter((label) => label.length > 0);
	const rawFilterPriority = searchParams.get('priority') ?? '';
	const filterPriority = resolvePriorityValue(rawFilterPriority, availablePriorities) ?? '';
	const rawFilterType = searchParams.get('type') ?? '';
	const filterType = resolveTaskTypeValue(rawFilterType, availableTypes) ?? '';

	useEffect(() => {
		if (isLoading || (rawFilterPriority === filterPriority && rawFilterType === filterType)) {
			return;
		}
		setSearchParams(params => {
			if (filterPriority) {
				params.set('priority', filterPriority);
			} else {
				params.delete('priority');
			}
			if (filterType) {
				params.set('type', filterType);
			} else {
				params.delete('type');
			}
			return params;
		}, { replace: true });
	}, [filterPriority, filterType, isLoading, rawFilterPriority, rawFilterType, setSearchParams]);

	return (
		<div className="container mx-auto px-4 py-8 transition-colors duration-200">
			<Board
				onEditTask={handleEditTask}
				onNewTask={onNewTask}
				highlightTaskId={highlightTaskId}
				tasks={tasks}
				onRefreshData={onRefreshData}
				statuses={statuses}
				milestones={milestones}
				milestoneEntities={milestoneEntities}
				archivedMilestones={archivedMilestones}
				isLoading={isLoading}
				availableLabels={availableLabels}
				laneMode={laneMode}
				onLaneChange={handleLaneChange}
				milestoneFilter={milestoneFilter}
				filterAssignee={filterAssignee}
				filterLabels={filterLabels}
				filterPriority={filterPriority}
				availablePriorities={availablePriorities}
				filterType={filterType}
				availableTypes={availableTypes}
				onFiltersChange={handleFiltersChange}
				hideEmptyColumns={hideEmptyColumns}
				dateFormat={dateFormat}
			/>
		</div>
	);
}
