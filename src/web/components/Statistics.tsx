import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../lib/api';
import type { TaskStatistics } from '../../core/statistics';
import type { Task } from '../../types';
import LoadingSpinner from './LoadingSpinner';
import { useI18n } from '../hooks/useI18n';

interface StatisticsData extends Omit<TaskStatistics, 'statusCounts' | 'priorityCounts'> {
	statusCounts: Record<string, number>;
	priorityCounts: Record<string, number>;
}

interface StatisticsProps {
	tasks?: Task[];
	isLoading?: boolean;
	onEditTask?: (task: Task) => void;
	projectName?: string;
}

interface ContributionGraphProps {
	data: Record<string, number>;
	total: number;
}

const ContributionGraph: React.FC<ContributionGraphProps> = ({ data, total }) => {
	const { t, locale } = useI18n();

	const weeks = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const days: { date: Date; dateStr: string; count: number }[] = [];
		for (let i = 364; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			const dateStr = `${year}-${month}-${day}`;
			days.push({ date: d, dateStr, count: data[dateStr] || 0 });
		}

		const firstDay = days[0]!.date.getDay();
		const paddingBefore = firstDay; // Sunday-start week

		const weeks: { date: Date | null; count: number }[][] = [];
		let currentWeek: { date: Date | null; count: number }[] = [];

		for (let i = 0; i < paddingBefore; i++) {
			currentWeek.push({ date: null, count: 0 });
		}

		for (const day of days) {
			currentWeek.push({ date: day.date, count: day.count });
			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}
		}

		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) {
				currentWeek.push({ date: null, count: 0 });
			}
			weeks.push(currentWeek);
		}

		return weeks;
	}, [data]);

	// GitHub official contribution graph colors
	const getLevel = (count: number): number => {
		if (count === 0) return 0;
		if (count <= 2) return 1;
		if (count <= 5) return 2;
		if (count <= 9) return 3;
		return 4;
	};

	// GitHub official colors — applied via inline style because Tailwind JIT
	// can't rebuild CSS on Windows due to Bun stack overflow crash
	const levelColors = {
		light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
		dark:  ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
	};

	// Watch html.dark class so colors react to theme toggles without rebuilding CSS
	const [isDark, setIsDark] = useState(() =>
		typeof document !== "undefined" && document.documentElement.classList.contains("dark")
	);
	useEffect(() => {
		const el = document.documentElement;
		const observer = new MutationObserver(() => {
			setIsDark(el.classList.contains("dark"));
		});
		observer.observe(el, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const formatDate = (date: Date) => {
		return date.toISOString().slice(0, 10);
	};

	// Build flat array for CSS Grid column-first rendering
	// Grid has 7 rows x N columns, filled column by column
	// weeks[wi][di] where di=0 is Monday
	const flatCells = useMemo(() => {
		const cells: { date: Date | null; count: number }[] = [];
		for (let wi = 0; wi < weeks.length; wi++) {
			for (let di = 0; di < 7; di++) {
				cells.push(weeks[wi]![di]!);
			}
		}
		return cells;
	}, [weeks]);

	const monthLabels = useMemo(() => {
		const labels: { label: string; weekIndex: number }[] = [];
		let lastMonth = -1;
		for (let wi = 0; wi < weeks.length; wi++) {
			const week = weeks[wi]!;
			const daysInWeek = week.filter((d) => d.date).map((d) => d.date!);
			if (daysInWeek.length === 0) continue;

			const monthsInWeek = new Set(daysInWeek.map((d) => d.getMonth()));
			if (monthsInWeek.size > 1) {
				const newMonth = Array.from(monthsInWeek).find((m) => m !== lastMonth);
				if (newMonth !== undefined) {
					lastMonth = newMonth;
					const firstDayOfNewMonth = daysInWeek.find((d) => d.getMonth() === newMonth);
					labels.push({
						label: firstDayOfNewMonth!.toLocaleString(locale, { month: "short" }),
						weekIndex: wi,
					});
				}
			} else {
				const m = daysInWeek[0]!.getMonth();
				if (m !== lastMonth) {
					lastMonth = m;
					labels.push({ label: daysInWeek[0]!.toLocaleString(locale, { month: "short" }), weekIndex: wi });
				}
			}
		}
		return labels;
	}, [weeks, locale]);

	const gap = 3;

	// Weekday labels: Sun-start week; Mon, Wed, Fri shown like GitHub
	const weekdayLabels = [
		{ label: '', show: false },      // Sun
		{ label: t.statistics.mon, show: true },  // Mon
		{ label: '', show: false },      // Tue
		{ label: t.statistics.wed, show: true },  // Wed
		{ label: '', show: false },      // Thu
		{ label: t.statistics.fri, show: true },  // Fri
		{ label: '', show: false },      // Sat
	];

	// Separate hover and click states so they don't conflict
	const [hoveredCell, setHoveredCell] = useState<number | null>(null);
	const [clickedCell, setClickedCell] = useState<number | null>(null);

	// Close clicked tooltip when clicking outside the graph
	useEffect(() => {
		const handleClickOutside = () => setClickedCell(null);
		if (clickedCell !== null) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	}, [clickedCell]);

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
			<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
				{t.statistics.contributionTitle(total)}
			</h3>

			{/* Main layout: 2 columns - labels sidebar + cells area */}
			<div className="grid" style={{ gridTemplateColumns: '28px 1fr', gap: `${gap}px` }}>
				{/* Empty corner */}
				<div></div>

				{/* Month labels */}
				<div className="relative h-4">
					{monthLabels.map(({ label, weekIndex }) => (
						<span
							key={weekIndex}
							className="absolute text-[10px] text-gray-500 dark:text-gray-400 leading-none"
							style={{
								left: `calc(${weekIndex} * (100% - ${(weeks.length - 1) * gap}px) / ${weeks.length} + ${weekIndex * gap}px)`,
							}}
						>
							{label}
						</span>
					))}
				</div>

				{/* Weekday labels - flex column so each label cell height = grid cell height */}
				<div className="flex flex-col" style={{ gap: `${gap}px` }}>
					{weekdayLabels.map((wd, i) => (
						<div key={i} className="flex-1 min-h-0 flex items-center">
							{wd.show && (
								<span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none">
									{wd.label}
								</span>
							)}
						</div>
					))}
				</div>

				{/* Cells grid: 53 columns x 7 rows, filled column by column */}
				<div
					className="grid grid-flow-col"
					style={{
						gap: `${gap}px`,
						gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
						gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
					}}
				>
					{flatCells.map((cell, i) => {
						const isHovered = hoveredCell === i;
						const isClicked = clickedCell === i;
						const showTooltip = cell.date && (isHovered || isClicked);
						const level = getLevel(cell.count);
						return (
							<div
								key={i}
								className="relative group"
								onMouseEnter={() => cell.date && setHoveredCell(i)}
								onMouseLeave={() => setHoveredCell((prev) => (prev === i ? null : prev))}
								onClick={(e) => {
									e.stopPropagation();
									if (cell.date) {
										setClickedCell((prev) => (prev === i ? null : i));
									}
								}}
							>
								<div
									className={`rounded-sm min-w-0 min-h-0 aspect-square transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-gray-400 dark:hover:ring-gray-500 hover:ring-offset-1 hover:ring-offset-white dark:hover:ring-offset-gray-800 ${
										cell.date ? "" : "bg-transparent"
									}`}
									style={cell.date ? { backgroundColor: levelColors[isDark ? "dark" : "light"][level] } : undefined}
								/>
								{cell.date && (
									<div
										className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 px-2.5 py-1.5 text-xs rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-opacity duration-150 ${
											showTooltip ? "opacity-100" : "opacity-0"
										} bg-gray-900 text-white dark:bg-white dark:text-gray-900`}
									>
										<div className="font-medium">{t.statistics.tasksCompletedOn(cell.count, formatDate(cell.date))}</div>
										{/* Little arrow */}
										<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 dark:border-t-white" />
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Legend */}
			<div className="flex items-center justify-end mt-3 space-x-1 text-xs text-gray-500 dark:text-gray-400">
				<span>{t.statistics.less}</span>
				{[0, 1, 2, 3, 4].map((level) => (
					<div
						key={level}
						className="w-[10px] aspect-square rounded-sm"
						style={{ backgroundColor: levelColors[isDark ? "dark" : "light"][level] }}
					/>
				))}
				<span>{t.statistics.more}</span>
			</div>
		</div>
	);
};

const Statistics: React.FC<StatisticsProps> = ({
	tasks: _tasks,
	isLoading: externalLoading,
	onEditTask,
	projectName,
}) => {
	const { t } = useI18n();
	const LOCAL_STORAGE_KEY = 'backlog:statistics';

	const [statistics, setStatistics] = useState<StatisticsData | null>(() => {
		try {
			const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
			if (cached) return JSON.parse(cached) as StatisticsData;
		} catch {}
		return null;
	});
	const [loading, setLoading] = useState(!statistics);
	const [error, setError] = useState<string | null>(null);
	const [loadingMessage, setLoadingMessage] = useState(t.statistics.loadingMessages[0] || '');

	useEffect(() => {
		let isMounted = true;
		let messageInterval: NodeJS.Timeout | undefined;
		let ws: WebSocket | undefined;
		let wsDebounceTimer: NodeJS.Timeout | undefined;

		const fetchStatistics = async (silent = false) => {
			if (!isMounted) return;

			try {
				if (!silent) {
					setLoading(true);
					setError(null);

					const loadingMessages = t.statistics.loadingMessages;
					if (isMounted) setLoadingMessage(loadingMessages[0] || '');

					let messageIndex = 0;
					messageInterval = setInterval(() => {
						if (!isMounted || messageIndex >= loadingMessages.length - 1) {
							clearInterval(messageInterval);
							return;
						}
						messageIndex++;
						setLoadingMessage(loadingMessages[messageIndex] || '');
					}, 800);
				}

				const data = await apiClient.fetchStatistics();

				if (messageInterval) {
					clearInterval(messageInterval);
					messageInterval = undefined;
				}

				if (isMounted) {
					setStatistics(data);
					try {
						localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
					} catch {}
				}
			} catch (err) {
				if (isMounted && !silent) {
					console.error('Failed to fetch statistics:', err);
					setError(t.statistics.failedToLoad);
				}
			} finally {
				if (isMounted && !silent) {
					setLoading(false);
				}
			}
		};

		fetchStatistics();

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		ws = new WebSocket(`${protocol}//${window.location.host}`);
		ws.onmessage = (event) => {
			if (!isMounted) return;
			if (event.data === 'statistics-updated') {
				// Server already debounced and recomputed; fetch immediately
				if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
				void fetchStatistics(true);
			} else if (event.data === 'tasks-updated') {
				// Fallback: server may not have cached stats yet, debounce to batch rapid changes
				if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
				wsDebounceTimer = setTimeout(() => fetchStatistics(true), 500);
			}
		};

		return () => {
			isMounted = false;
			if (messageInterval) {
				clearInterval(messageInterval);
			}
			if (wsDebounceTimer) {
				clearTimeout(wsDebounceTimer);
			}
			if (ws) {
				ws.close();
			}
		};
	}, [t]);

	if (loading || externalLoading) {
		return (
			<div className="flex flex-col justify-center items-center h-64 space-y-4">
				<LoadingSpinner size="lg" text="" />
				<div className="text-center">
					<p className="text-lg font-medium text-gray-900 dark:text-gray-100">
						{loading ? loadingMessage : t.statistics.loading}
					</p>
					<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
						{t.statistics.mightTakeAWhile}
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-8 text-center">
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
					<p className="text-red-600 dark:text-red-400 font-medium">{t.statistics.errorLoading}</p>
					<p className="text-red-500 dark:text-red-300 text-sm mt-1">{error}</p>
				</div>
			</div>
		);
	}

	if (!statistics) {
		return (
			<div className="p-8 text-center">
				<p className="text-gray-500 dark:text-gray-400">{t.statistics.noStats}</p>
			</div>
		);
	}

	const TaskPreview = ({ task, showDate, onClick }: { task: Task; showDate: 'created' | 'updated' | 'dueDate'; onClick?: () => void }) => {
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

		const displayDate = showDate === 'created'
			? task.createdDate
			: showDate === 'dueDate'
				? task.dueDate
				: task.updatedDate || task.createdDate;
		const dateLabel = showDate === 'created'
			? t.common.created
			: showDate === 'dueDate'
				? t.common.dueBy
				: t.common.updated;

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
						{task.id} • {dateLabel} {displayDate ? formatDate(displayDate) : ''}
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
					{projectName ? t.statistics.title(projectName) : t.statistics.defaultTitle}
				</h1>
				<p className="text-gray-600 dark:text-gray-400">
					{t.statistics.overview}
				</p>
			</div>

			{/* Contribution Graph */}
			{statistics.completionHeatmap && (
				<ContributionGraph data={statistics.completionHeatmap} total={statistics.completedTasks} />
			)}

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
							<p className="text-gray-600 dark:text-gray-400 text-sm">{t.statistics.totalTasks}</p>
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
							<p className="text-gray-600 dark:text-gray-400 text-sm">{t.statistics.completed}</p>
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
							<p className="text-gray-600 dark:text-gray-400 text-sm">{t.statistics.completion}</p>
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
							<p className="text-gray-600 dark:text-gray-400 text-sm">{t.statistics.drafts}</p>
						</div>
					</div>
				</div>
			</div>

			{/* Progress Bar */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.statistics.overallProgress}</h3>
				<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-circle h-4 mb-2">
					<div 
						className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-circle transition-all duration-300"
						style={{ width: `${statistics.completionPercentage}%` }}
					></div>
				</div>
				<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
					<span>{t.statistics.completedCount(statistics.completedTasks)}</span>
					<span>{t.statistics.remainingCount(statistics.totalTasks - statistics.completedTasks)}</span>
				</div>
			</div>

			{/* Status and Priority Distribution */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Status Distribution */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.statistics.statusDistribution}</h3>
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
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.statistics.priorityDistribution}</h3>
					<div className="space-y-4">
						{Object.entries(statistics.priorityCounts)
							.filter(([, count]) => count > 0)
							.map(([priority, count]) => (
							<div key={priority} className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<PriorityIcon priority={priority} />
									<span className={`px-3 py-1 rounded-circle text-sm font-medium ${getPriorityColor(priority)}`}>
										{priority === 'none' ? t.statistics.noPriority : (t.common[priority.toLowerCase() as 'high' | 'medium' | 'low'] || priority.charAt(0).toUpperCase() + priority.slice(1))}
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
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.statistics.recentlyCreated}</h3>
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
						<p className="text-gray-500 dark:text-gray-400 text-sm">{t.statistics.noRecentlyCreated}</p>
					)}
				</div>

				{/* Recently Updated */}
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.statistics.recentlyUpdated}</h3>
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
						<p className="text-gray-500 dark:text-gray-400 text-sm">{t.statistics.noRecentlyUpdated}</p>
					)}
				</div>
			</div>

			{/* Project Health - Completely redesigned as a summary row */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.statistics.projectHealth}</h3>
					
					<div className="flex items-center space-x-4 text-sm">
						<div className="flex items-center space-x-1">
							<span className="text-gray-600 dark:text-gray-400">{t.statistics.avgAge}</span>
							<span className="font-medium text-gray-900 dark:text-gray-100">{statistics.projectHealth.averageTaskAge}{t.statistics.daysShort}</span>
						</div>
						
						{statistics.projectHealth.atRiskTasks.length > 0 && (
							<div className="flex items-center space-x-1" title={t.statistics.atRiskTooltip}>
								<div className="w-2 h-2 bg-amber-500 rounded-circle"></div>
								<span className="font-medium text-amber-700 dark:text-amber-400">{t.statistics.atRiskCount(statistics.projectHealth.atRiskTasks.length)}</span>
							</div>
						)}
						
						{statistics.projectHealth.overdueTasks.length > 0 && (
							<div className="flex items-center space-x-1" title={t.statistics.overdueTooltip}>
								<div className="w-2 h-2 bg-red-500 rounded-circle"></div>
								<span className="font-medium text-red-700 dark:text-red-400">{t.statistics.overdueCount(statistics.projectHealth.overdueTasks.length)}</span>
							</div>
						)}
						
						{statistics.projectHealth.staleTasks.length > 0 && (
							<div className="flex items-center space-x-1" title={t.statistics.staleTooltip}>
								<div className="w-2 h-2 bg-slate-400 rounded-circle"></div>
								<span className="font-medium text-slate-700 dark:text-slate-400">{t.statistics.staleCount(statistics.projectHealth.staleTasks.length)}</span>
							</div>
						)}
						
						{statistics.projectHealth.blockedTasks.length > 0 && (
							<div className="flex items-center space-x-1" title={t.statistics.blockedTasksDesc}>
								<div className="w-2 h-2 bg-red-500 rounded-circle"></div>
								<span className="font-medium text-red-700 dark:text-red-400">{t.statistics.blockedCount(statistics.projectHealth.blockedTasks.length)}</span>
							</div>
						)}
						
						{statistics.projectHealth.atRiskTasks.length === 0 && statistics.projectHealth.overdueTasks.length === 0 && statistics.projectHealth.staleTasks.length === 0 && statistics.projectHealth.blockedTasks.length === 0 && (
							<div className="flex items-center space-x-1">
								<div className="w-2 h-2 bg-green-500 rounded-circle"></div>
								<span className="font-medium text-green-700 dark:text-green-400">{t.statistics.allGood}</span>
							</div>
						)}
					</div>
				</div>
				
				{/* Expandable task lists - only show if there are issues */}
				{(statistics.projectHealth.atRiskTasks.length > 0 || statistics.projectHealth.overdueTasks.length > 0 || statistics.projectHealth.staleTasks.length > 0 || statistics.projectHealth.blockedTasks.length > 0) && (
					<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{/* At Risk Tasks */}
							{statistics.projectHealth.atRiskTasks.length > 0 && (
								<div>
									<h4 className="font-medium text-amber-700 dark:text-amber-400 mb-3 text-sm">
										{t.statistics.atRiskTasksTitle}
									</h4>
									<p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
										{t.statistics.atRiskTasksDesc}
									</p>
									<div className="space-y-2">
										{statistics.projectHealth.atRiskTasks.slice(0, 3).map((task) => (
											<TaskPreview 
												key={task.id}
												task={task} 
												showDate="dueDate" 
												onClick={onEditTask ? () => onEditTask(task) : undefined}
											/>
										))}
										{statistics.projectHealth.atRiskTasks.length > 3 && (
											<p className="text-xs text-gray-500 dark:text-gray-400 px-3">
												{t.statistics.moreAtRiskTasks(statistics.projectHealth.atRiskTasks.length - 3)}
											</p>
										)}
									</div>
								</div>
							)}

								{/* Overdue Tasks */}
							{statistics.projectHealth.overdueTasks.length > 0 && (
								<div>
									<h4 className="font-medium text-red-700 dark:text-red-400 mb-3 text-sm">
										{t.statistics.overdueTasksTitle}
									</h4>
									<p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
										{t.statistics.overdueTasksDesc}
									</p>
									<div className="space-y-2">
										{statistics.projectHealth.overdueTasks.slice(0, 3).map((task) => (
											<TaskPreview 
												key={task.id}
												task={task} 
												showDate="dueDate" 
												onClick={onEditTask ? () => onEditTask(task) : undefined}
											/>
										))}
										{statistics.projectHealth.overdueTasks.length > 3 && (
											<p className="text-xs text-gray-500 dark:text-gray-400 px-3">
												{t.statistics.moreOverdueTasks(statistics.projectHealth.overdueTasks.length - 3)}
											</p>
										)}
									</div>
								</div>
							)}

								{/* Stale Tasks */}
							{statistics.projectHealth.staleTasks.length > 0 && (
								<div>
									<h4 className="font-medium text-slate-700 dark:text-slate-400 mb-3 text-sm">
										{t.statistics.staleTasksTitle}
									</h4>
									<p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
										{t.statistics.staleTasksDesc}
									</p>
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
												{t.statistics.moreStaleTasks(statistics.projectHealth.staleTasks.length - 3)}
											</p>
										)}
									</div>
								</div>
							)}

								{/* Blocked Tasks */}
							{statistics.projectHealth.blockedTasks.length > 0 && (
								<div>
									<h4 className="font-medium text-red-700 dark:text-red-400 mb-3 text-sm">
										{t.statistics.blockedTasksTitle}
									</h4>
									<p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
										{t.statistics.blockedTasksDesc}
									</p>
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
												{t.statistics.moreBlockedTasks(statistics.projectHealth.blockedTasks.length - 3)}
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
