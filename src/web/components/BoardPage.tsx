import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Board from './Board';
import { type Task } from '../../types';

interface BoardPageProps {
	onEditTask: (task: Task) => void;
	onNewTask: () => void;
	tasks: Task[];
	onRefreshData?: () => Promise<void>;
}

export default function BoardPage({ onEditTask, onNewTask, tasks, onRefreshData }: BoardPageProps) {
	const [searchParams, setSearchParams] = useSearchParams();
	const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);

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

	return (
		<div className="container mx-auto px-4 py-8 transition-colors duration-200">
			<Board onEditTask={handleEditTask} onNewTask={onNewTask} highlightTaskId={highlightTaskId} tasks={tasks} onRefreshData={onRefreshData} />
		</div>
	);
}