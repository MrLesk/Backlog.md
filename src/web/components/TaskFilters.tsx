import React, { useState, useEffect } from 'react';
import type { TaskFilters } from '../hooks/useTaskFilters';

interface TaskFiltersProps {
	filters: TaskFilters;
	onStatusChange: (status?: string) => void;
	onPriorityChange: (priority?: string) => void;
	onSearchChange: (search?: string) => void;
	onAssigneeChange: (assignee?: string) => void;
	onClearAll: () => void;
	availableStatuses: string[];
	hasActiveFilters: boolean;
}

const TaskFiltersComponent: React.FC<TaskFiltersProps> = ({
	filters,
	onStatusChange,
	onPriorityChange,
	onSearchChange,
	onAssigneeChange,
	onClearAll,
	availableStatuses,
	hasActiveFilters,
}) => {
	const [searchText, setSearchText] = useState(filters.search || '');
	
	// Debounce search input
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			onSearchChange(searchText || undefined);
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [searchText, onSearchChange]);

	// Update local search state when filters change externally
	useEffect(() => {
		setSearchText(filters.search || '');
	}, [filters.search]);

	const priorities = ['high', 'medium', 'low'];

	const handleClearAll = () => {
		setSearchText('');
		onClearAll();
	};

	return (
		<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
			<div className="flex flex-col space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium text-gray-900 dark:text-white">
						Filter Tasks
					</h3>
					{hasActiveFilters && (
						<button
							onClick={handleClearAll}
							className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
						>
							Clear All
						</button>
					)}
				</div>
				
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{/* Status Filter */}
					<div className="space-y-2">
						<label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
							Status
						</label>
						<select
							value={filters.status || ''}
							onChange={(e) => onStatusChange(e.target.value || undefined)}
							className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
						>
							<option value="">All Statuses</option>
							{availableStatuses.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</div>

					{/* Priority Filter */}
					<div className="space-y-2">
						<label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
							Priority
						</label>
						<select
							value={filters.priority || ''}
							onChange={(e) => onPriorityChange(e.target.value || undefined)}
							className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
						>
							<option value="">All Priorities</option>
							{priorities.map((priority) => (
								<option key={priority} value={priority}>
									{priority.charAt(0).toUpperCase() + priority.slice(1)}
								</option>
							))}
						</select>
					</div>

					{/* Assignee Filter */}
					<div className="space-y-2">
						<label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
							Assignee
						</label>
						<input
							type="text"
							value={filters.assignee || ''}
							onChange={(e) => onAssigneeChange(e.target.value || undefined)}
							placeholder="Enter assignee..."
							className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
						/>
					</div>

					{/* Search Filter */}
					<div className="space-y-2">
						<label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
							Search
						</label>
						<input
							type="text"
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							placeholder="Search title or description..."
							className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
						/>
					</div>
				</div>

				{/* Active filters indicator */}
				{hasActiveFilters && (
					<div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
						<span>Active filters:</span>
						<div className="flex flex-wrap gap-1">
							{filters.status && (
								<span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full">
									Status: {filters.status}
								</span>
							)}
							{filters.priority && (
								<span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-full">
									Priority: {filters.priority}
								</span>
							)}
							{filters.assignee && (
								<span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-full">
									Assignee: {filters.assignee}
								</span>
							)}
							{filters.search && (
								<span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded-full">
									Search: "{filters.search}"
								</span>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default TaskFiltersComponent;
