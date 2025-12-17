import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Board from './Board';
import { type Milestone, type Task } from '../../types';
import { type LaneMode } from '../lib/lanes';

interface BoardPageProps {
	onEditTask: (task: Task) => void;
	onNewTask: () => void;
	tasks: Task[];
	onRefreshData?: () => Promise<void>;
	statuses: string[];
	milestones: string[];
	milestoneEntities: Milestone[];
	isLoading: boolean;
}

export default function BoardPage({ onEditTask, onNewTask, tasks, onRefreshData, statuses, milestones, milestoneEntities, isLoading }: BoardPageProps) {
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
				isLoading={isLoading}
				laneMode={laneMode}
				onLaneChange={handleLaneChange}
				milestoneFilter={milestoneFilter}
			/>
		</div>
	);
}
