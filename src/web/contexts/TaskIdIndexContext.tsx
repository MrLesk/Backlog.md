import React, { createContext, useContext, useMemo } from 'react';
import { type Task } from '../../types';
import { buildTaskIdIndex, type TaskIdIndex } from '../utils/task-id-links';

const EMPTY_INDEX: TaskIdIndex = new Map();

const TaskIdIndexContext = createContext<TaskIdIndex>(EMPTY_INDEX);

/** Known task IDs, used to auto-link task references in rendered markdown. */
export const useTaskIdIndex = () => useContext(TaskIdIndexContext);

interface TaskIdIndexProviderProps {
	tasks: Task[];
	children: React.ReactNode;
}

export const TaskIdIndexProvider: React.FC<TaskIdIndexProviderProps> = ({ tasks, children }) => {
	const index = useMemo(() => buildTaskIdIndex(tasks), [tasks]);

	return <TaskIdIndexContext.Provider value={index}>{children}</TaskIdIndexContext.Provider>;
};
