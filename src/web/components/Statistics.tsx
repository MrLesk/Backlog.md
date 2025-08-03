import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { TaskStatistics } from '../../core/statistics';
import type { Task } from '../../types';
import LoadingSpinner from './LoadingSpinner';

interface StatisticsData extends Omit<TaskStatistics, 'statusCounts' | 'priorityCounts'> {
	statusCounts: Record<string, number>;
	priorityCounts: Record<string, number>;
}

interface StatisticsProps {
	tasks?: Task[];
	isLoading?: boolean;
	onEditTask?: (task: Task) => void;
}

const Statistics: React.FC<StatisticsProps> = ({ tasks, isLoading: externalLoading, onEditTask }) => {
	const [statistics, setStatistics] = useState<StatisticsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [loadingMessage, setLoadingMessage] = useState('Building statistics...');

	useEffect(() => {
		let isMounted = true;
		let messageInterval: NodeJS.Timeout;

		const fetchStatistics = async () => {
			if (!isMounted) return;
			
			try {
				setLoading(true);
				setError(null);
				
				// Simulate the loading messages from CLI
				const loadingMessages = [
					'Building statistics...',
					'Loading local tasks...',
					'Loading completed tasks...',
					'Merging tasks...',
					'Checking task states across branches...',
					'Loading drafts...',
					'Calculating statistics...'
				];

				// Start with first message
				if (isMounted) setLoadingMessage(loadingMessages[0]);

				// Show loading progress - each message for 1 second, no cycling
				const showNextMessage = async () => {
					for (let i = 1; i < loadingMessages.length; i++) {
						if (!isMounted) return;
						await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
						if (isMounted) {
							setLoadingMessage(loadingMessages[i]);
						}
					}
				};

				// Start showing messages and API call in parallel
				const [data] = await Promise.all([
					apiClient.fetchStatistics(),
					showNextMessage()
				]);
				
				if (isMounted) {
					setStatistics(data);
				}
			} catch (err) {
				if (isMounted) {
					console.error('Failed to fetch statistics:', err);
					setError('Failed to load statistics');
				}
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		};

		fetchStatistics();

		return () => {
			isMounted = false;
			if (messageInterval) {
				clearInterval(messageInterval);
			}
		};
	}, []);

	if (loading || externalLoading) {
		return (
			<div className="flex flex-col justify-center items-center h-64 space-y-4">
				<LoadingSpinner size="lg" text="" />
				<div className="text-center">
					<p className="text-lg font-medium text-gray-900 dark:text-gray-100">
						{loading ? loadingMessage : 'Loading statistics...'}
					</p>
					<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
						This might take a while...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-8 text-center">
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
					<p className="text-red-600 dark:text-red-400 font-medium">Error loading statistics</p>
					<p className="text-red-500 dark:text-red-300 text-sm mt-1">{error}</p>
				</div>
			</div>
		);
	}

	if (!statistics) {
		return (
			<div className="p-8 text-center">
				<p className="text-gray-500 dark:text-gray-400">No statistics available</p>
			</div>
		);
	}

	const TaskPreview = ({ task, showDate, onClick }: { task: Task; showDate: 'created' | 'updated'; onClick?: () => void }) => {
		const formatDate = (dateStr: string) => {
			const hasTime = dateStr.includes(" ") || dateStr.includes("T");
			const date = new Date(dateStr.replace(" ", "T") + (hasTime ? ":00Z" : "T00:00:00Z"));
			
			if (hasTime) {
				return date.toLocaleString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});
			} else {
				return date.toLocaleDateString();
			}
		};

		const displayDate = showDate === 'created' ? task.createdDate : task.updatedDate || task.createdDate;

		return (
			<div 
				key={task.id} 
				className={`flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors duration-200 ${
					onClick ? 'hover:bg-gray-100 dark:hover:bg-gray-600/50 cursor-pointer' : ''
				}`}
				onClick={onClick}
			>
				<StatusIcon status={task.status} />
				<div className="flex-1 min-w-0">
					<p className="font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						{task.id} • {showDate === 'created' ? 'Created' : 'Updated'} {formatDate(displayDate)}
					</p>
				</div>
			</div>
		);
	};

	const StatusIcon = ({ status }: { status: string }) => {
		switch (status.toLowerCase()) {
			case 'to do':
				return (
					<svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				);
			case 'in progress':
				return (
					<svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				);
			case 'done':
				return (
					<svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
						<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				);
			default:
				return (
					<svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				);
		}
	};

	const PriorityIcon = ({ priority }: { priority: string }) => {
		switch (priority.toLowerCase()) {
			case 'high':
				return (
					<svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
				);
			case 'medium':
				return (
					<svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
				);
			case 'low':
				return (
					<svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
				);
			default:
				return (
					<svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
					</svg>
				);
		}
	};

	const getStatusColor = (status: string) => {
		switch (status.toLowerCase()) {
			case 'to do': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
			case 'in progress': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
			case 'done': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
			default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority.toLowerCase()) {
			case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
			case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
			case 'low': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
			case 'none': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
			default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
		}
	};

	return (
		<div className="max-w-7xl mx-auto p-6 space-y-8">
			{/* Header */}
			<div className="text-center">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
					Project Statistics
				</h1>
				<p className="text-gray-600 dark:text-gray-400">
					Overview of your project's task metrics and activity
				</p>
			</div>

			{/* Key Metrics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{/* Total Tasks */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<div className="flex items-center">
						<div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
							<svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
							</svg>
						</div>
						<div className="ml-4">
							<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statistics.totalTasks}</p>
							<p className="text-gray-600 dark:text-gray-400 text-sm">Total Tasks</p>
						</div>
					</div>
				</div>

				{/* Completed Tasks */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<div className="flex items-center">
						<div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
							<svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
								<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<div className="ml-4">
							<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statistics.completedTasks}</p>
							<p className="text-gray-600 dark:text-gray-400 text-sm">Completed</p>
						</div>
					</div>
				</div>

				{/* Completion Percentage */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<div className="flex items-center">
						<div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
							<svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
							</svg>
						</div>
						<div className="ml-4">
							<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statistics.completionPercentage}%</p>
							<p className="text-gray-600 dark:text-gray-400 text-sm">Completion</p>
						</div>
					</div>
				</div>

				{/* Drafts */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<div className="flex items-center">
						<div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
							<svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
						</div>
						<div className="ml-4">
							<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statistics.draftCount}</p>
							<p className="text-gray-600 dark:text-gray-400 text-sm">Drafts</p>
						</div>
					</div>
				</div>
			</div>

			{/* Progress Bar */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Overall Progress</h3>
				<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-circle h-4 mb-2">
					<div 
						className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-circle transition-all duration-300"
						style={{ width: `${statistics.completionPercentage}%` }}
					></div>
				</div>
				<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
					<span>{statistics.completedTasks} completed</span>
					<span>{statistics.totalTasks - statistics.completedTasks} remaining</span>
				</div>
			</div>

			{/* Status and Priority Distribution */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Status Distribution */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Distribution</h3>
					<div className="space-y-4">
						{Object.entries(statistics.statusCounts)
							.filter(([, count]) => count > 0)
							.map(([status, count]) => (
							<div key={status} className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<StatusIcon status={status} />
									<span className={`px-3 py-1 rounded-circle text-sm font-medium ${getStatusColor(status)}`}>
										{status}
									</span>
								</div>
								<div className="flex items-center space-x-3">
									<div className="text-right">
										<div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{count}</div>
										<div className="text-xs text-gray-500 dark:text-gray-400">
											{Math.round((count / statistics.totalTasks) * 100)}%
										</div>
									</div>
									<div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-circle h-2">
										<div 
											className="bg-blue-500 h-2 rounded-circle transition-all duration-300"
											style={{ width: `${(count / statistics.totalTasks) * 100}%` }}
										></div>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Priority Distribution */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Priority Distribution</h3>
					<div className="space-y-4">
						{Object.entries(statistics.priorityCounts)
							.filter(([, count]) => count > 0)
							.map(([priority, count]) => (
							<div key={priority} className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<PriorityIcon priority={priority} />
									<span className={`px-3 py-1 rounded-circle text-sm font-medium ${getPriorityColor(priority)}`}>
										{priority === 'none' ? 'No Priority' : priority.charAt(0).toUpperCase() + priority.slice(1)}
									</span>
								</div>
								<div className="flex items-center space-x-3">
									<div className="text-right">
										<div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{count}</div>
										<div className="text-xs text-gray-500 dark:text-gray-400">
											{Math.round((count / statistics.totalTasks) * 100)}%
										</div>
									</div>
									<div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-circle h-2">
										<div 
											className="bg-yellow-500 h-2 rounded-circle transition-all duration-300"
											style={{ width: `${(count / statistics.totalTasks) * 100}%` }}
										></div>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Recent Activity */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Recently Created */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recently Created</h3>
					{statistics.recentActivity.created.length > 0 ? (
						<div className="space-y-3">
							{statistics.recentActivity.created.map((task) => (
								<TaskPreview 
									task={task} 
									showDate="created" 
									onClick={onEditTask ? () => onEditTask(task) : undefined}
								/>
							))}
						</div>
					) : (
						<p className="text-gray-500 dark:text-gray-400 text-sm">No recently created tasks</p>
					)}
				</div>

				{/* Recently Updated */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recently Updated</h3>
					{statistics.recentActivity.updated.length > 0 ? (
						<div className="space-y-3">
							{statistics.recentActivity.updated.map((task) => (
								<TaskPreview 
									task={task} 
									showDate="updated" 
									onClick={onEditTask ? () => onEditTask(task) : undefined}
								/>
							))}
						</div>
					) : (
						<p className="text-gray-500 dark:text-gray-400 text-sm">No recently updated tasks</p>
					)}
				</div>
			</div>

			{/* Project Health - Completely redesigned as a summary row */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Project Health</h3>
					
					<div className="flex items-center space-x-4 text-sm">
						<div className="flex items-center space-x-1">
							<span className="text-gray-600 dark:text-gray-400">Avg age:</span>
							<span className="font-medium text-gray-900 dark:text-gray-100">{statistics.projectHealth.averageTaskAge}d</span>
						</div>
						
						{statistics.projectHealth.staleTasks.length > 0 && (
							<div className="flex items-center space-x-1">
								<div className="w-2 h-2 bg-yellow-500 rounded-circle"></div>
								<span className="font-medium text-yellow-700 dark:text-yellow-400">{statistics.projectHealth.staleTasks.length} stale</span>
							</div>
						)}
						
						{statistics.projectHealth.blockedTasks.length > 0 && (
							<div className="flex items-center space-x-1">
								<div className="w-2 h-2 bg-red-500 rounded-circle"></div>
								<span className="font-medium text-red-700 dark:text-red-400">{statistics.projectHealth.blockedTasks.length} blocked</span>
							</div>
						)}
						
						{statistics.projectHealth.staleTasks.length === 0 && statistics.projectHealth.blockedTasks.length === 0 && (
							<div className="flex items-center space-x-1">
								<div className="w-2 h-2 bg-green-500 rounded-circle"></div>
								<span className="font-medium text-green-700 dark:text-green-400">All good!</span>
							</div>
						)}
					</div>
				</div>
				
				{/* Expandable task lists - only show if there are issues */}
				{(statistics.projectHealth.staleTasks.length > 0 || statistics.projectHealth.blockedTasks.length > 0) && (
					<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Stale Tasks */}
							{statistics.projectHealth.staleTasks.length > 0 && (
								<div>
									<h4 className="font-medium text-yellow-700 dark:text-yellow-400 mb-3 text-sm">
										Stale Tasks (&gt;30 days)
									</h4>
									<div className="space-y-2">
										{statistics.projectHealth.staleTasks.slice(0, 3).map((task) => (
											<TaskPreview 
												key={task.id}
												task={task} 
												showDate="updated" 
												onClick={onEditTask ? () => onEditTask(task) : undefined}
											/>
										))}
										{statistics.projectHealth.staleTasks.length > 3 && (
											<p className="text-xs text-gray-500 dark:text-gray-400 px-3">
												+{statistics.projectHealth.staleTasks.length - 3} more stale tasks
											</p>
										)}
									</div>
								</div>
							)}

							{/* Blocked Tasks */}
							{statistics.projectHealth.blockedTasks.length > 0 && (
								<div>
									<h4 className="font-medium text-red-700 dark:text-red-400 mb-3 text-sm">
										Blocked Tasks
									</h4>
									<div className="space-y-2">
										{statistics.projectHealth.blockedTasks.slice(0, 3).map((task) => (
											<TaskPreview 
												key={task.id}
												task={task} 
												showDate="created" 
												onClick={onEditTask ? () => onEditTask(task) : undefined}
											/>
										))}
										{statistics.projectHealth.blockedTasks.length > 3 && (
											<p className="text-xs text-gray-500 dark:text-gray-400 px-3">
												+{statistics.projectHealth.blockedTasks.length - 3} more blocked tasks
											</p>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

		</div>
	);
};

export default Statistics;