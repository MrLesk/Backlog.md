import React, { useMemo, useState } from "react";
import type { Task } from "../../types";

interface GanttTask {
	task: Task;
	id: string;
	title: string;
	status: string;
	plannedStart: Date;
	plannedEnd: Date;
}

function toDate(value: string): Date | null {
	if (!value) return null;
	const hasTime = value.includes(" ") || value.includes("T");
	const iso = value.replace(" ", "T") + (hasTime ? ":00Z" : "T00:00:00Z");
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

type ZoomLevel = "1d" | "7d" | "30d" | "90d" | "365d" | "all";

interface GanttPageProps {
	tasks: Task[];
	onEditTask?: (task: Task) => void;
}

export const GanttPage: React.FC<GanttPageProps> = ({ tasks, onEditTask }) => {
	const [zoom, setZoom] = useState<ZoomLevel>("30d");
	const ganttTasks: GanttTask[] = useMemo(() => {
		return tasks
			.map((task) => {
				const start = task.plannedStart ? toDate(task.plannedStart) : null;
				const end = task.plannedEnd ? toDate(task.plannedEnd) : null;
				if (!start && !end) return null;
				const normalizedStart = start ?? end;
				const normalizedEnd = end ?? start;
				if (!normalizedStart || !normalizedEnd) return null;
				if (normalizedEnd.getTime() < normalizedStart.getTime()) return null;
				return {
					task,
					id: task.id,
					title: task.title,
					status: task.status,
					plannedStart: normalizedStart,
					plannedEnd: normalizedEnd,
				};
			})
			.filter((t): t is GanttTask => Boolean(t));
	}, [tasks]);

	const fullRange = useMemo(() => {
		if (ganttTasks.length === 0) return null;
		let min = ganttTasks[0]!.plannedStart.getTime();
		let max = ganttTasks[0]!.plannedEnd.getTime();
		for (const task of ganttTasks) {
			const start = task.plannedStart.getTime();
			const end = task.plannedEnd.getTime();
			if (start < min) min = start;
			if (end > max) max = end;
		}
		// Add small padding
		const dayMs = 24 * 60 * 60 * 1000;
		return { min: min - dayMs, max: max + dayMs };
	}, [ganttTasks]);

	const dayMs = 24 * 60 * 60 * 1000;

	const range = useMemo(() => {
		if (!fullRange) return null;
		const spanMs = fullRange.max - fullRange.min;

		// "All" shows the full task planning range
		if (zoom === "all") {
			const span = Math.max(spanMs, dayMs);
			return { min: fullRange.min, max: fullRange.max, span };
		}

		// Other zoom levels anchor relative to "today"
		const windowDays = zoom === "1d" ? 1 : zoom === "7d" ? 7 : zoom === "30d" ? 30 : zoom === "90d" ? 90 : 365;
		const windowMs = windowDays * dayMs;

		const now = Date.now();
		const start = now - dayMs; // 1 day before today
		const min = start;
		const max = min + windowMs;
		const span = Math.max(max - min, dayMs);
		return { min, max, span };
	}, [fullRange, zoom]);

	const formatDay = (d: Date, showYear = false) =>
		d.toLocaleDateString(undefined, {
			year: showYear ? "numeric" : undefined,
			month: "short",
			day: "numeric",
		});

	const ticks = useMemo(() => {
		if (!range) return [];
		const out: { time: number; label: string }[] = [];

		// Short windows: daily ticks
		if (zoom === "1d" || zoom === "7d") {
			const step = dayMs;
			const start = Math.floor(range.min / step) * step;
			for (let t = start; t <= range.max + 1; t += step) {
				out.push({ time: t, label: formatDay(new Date(t), false) });
			}
			return out;
		}

		// 30d window: weekly ticks (start-of-week)
		if (zoom === "30d") {
			const step = 7 * dayMs;
			const startDate = new Date(range.min);
			startDate.setHours(0, 0, 0, 0);
			// Align to Monday (0=Sunday,...,6=Saturday)
			const day = startDate.getDay();
			const diffToMonday = (day + 6) % 7; // 0 if Monday, 1 if Tuesday, etc.
			startDate.setDate(startDate.getDate() - diffToMonday);

			for (let t = startDate.getTime(); t <= range.max + 1; t += step) {
				out.push({ time: t, label: formatDay(new Date(t), false) });
			}
			if (out.length === 0) {
				out.push({ time: range.min, label: formatDay(new Date(range.min), false) });
			}
			return out;
		}

		// Longer windows: month-aligned ticks
		const startDate = new Date(range.min);
		startDate.setHours(0, 0, 0, 0);
		startDate.setDate(1); // start of month

		const endDate = new Date(range.max);
		endDate.setHours(0, 0, 0, 0);

		const showYear = zoom === "365d" || zoom === "all";

		for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
			out.push({ time: d.getTime(), label: formatDay(d, showYear) });
		}

		if (out.length === 0) {
			out.push({ time: range.min, label: formatDay(new Date(range.min), showYear) });
		}

		return out;
	}, [range, zoom]);

	return (
		<div className="container mx-auto px-4 py-8 transition-colors duration-200">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gantt Timeline</h1>
				<p className="text-sm text-gray-500 dark:text-gray-400">
					Planned work window for tasks with start/end dates.
				</p>
			</div>

			{!range || ganttTasks.length === 0 ? (
				<div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-8 text-center">
					<p className="text-sm text-gray-600 dark:text-gray-300">
						No tasks with planned dates yet. Add{" "}
						<span className="font-medium">plannedStart</span> and <span className="font-medium">plannedEnd</span>{" "}
						in the task details to see them here.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center justify-between mb-2">
						<div className="text-xs text-gray-500 dark:text-gray-400">
							View window:{" "}
							<span className="font-medium text-gray-700 dark:text-gray-200">
								{zoom === "1d"
									? "1 day"
									: zoom === "7d"
										? "7 days"
										: zoom === "30d"
											? "30 days"
											: zoom === "90d"
												? "3 months"
												: zoom === "365d"
													? "12 months"
													: "All planned range"}
							</span>
						</div>
						<div className="inline-flex rounded-md shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
							{(["1d", "7d", "30d", "90d", "365d", "all"] as ZoomLevel[]).map((value) => (
								<button
									key={value}
									type="button"
									onClick={() => setZoom(value)}
									className={`px-2.5 py-1 text-xs font-medium border-l border-gray-200 dark:border-gray-700 first:border-l-0 transition-colors duration-150 ${
										zoom === value
											? "bg-blue-600 text-white dark:bg-blue-500"
											: "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
									}`}
								>
									{value === "1d"
										? "1d"
										: value === "7d"
											? "7d"
											: value === "30d"
												? "30d"
												: value === "90d"
													? "3m"
													: value === "365d"
														? "12m"
														: "All"}
								</button>
							))}
						</div>
					</div>

					{/* Simple time axis aligned with task rows */}
					<div className="relative h-8 mb-2">
						<div className="flex items-center gap-3 h-full">
							{/* Reserve the same width as the task title column */}
							<div className="w-56" />
							<div className="flex-1 relative h-full">
								{/* Baseline */}
								<div className="absolute inset-y-1 left-0 right-0 border-t border-gray-300 dark:border-gray-700" />
								{/* Proportionally positioned tick labels */}
								<div className="absolute inset-x-0 top-0 h-full">
									{ticks.map((tick) => {
										const rawOffset =
											range.span > 0 ? ((tick.time - range.min) / range.span) * 100 : 0;
										const clampedOffset = Math.min(Math.max(rawOffset, 0), 100);

										let translate = "-50%";
										if (clampedOffset === 0) {
											translate = "0%";
										} else if (clampedOffset === 100) {
											translate = "-100%";
										}

										return (
											<div
												key={tick.time}
												className="absolute -top-1 text-xs text-gray-500 dark:text-gray-400"
												style={{
													left: `${clampedOffset}%`,
													transform: `translateX(${translate})`,
												}}
											>
												{tick.label}
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</div>

					<div className="space-y-2">
						{ganttTasks.map((task) => {
							const startMs = task.plannedStart.getTime();
							const endMs = task.plannedEnd.getTime();

							const clampedStart = Math.max(startMs, range.min);
							const clampedEnd = Math.min(endMs, range.max);

							if (clampedEnd <= range.min || clampedStart >= range.max) {
								return null;
							}

							const startOffset = ((clampedStart - range.min) / range.span) * 100;
							const width = Math.max(((clampedEnd - clampedStart) / range.span) * 100, 2);

							const status = (task.status || "").toLowerCase();
							const color =
								status.includes("done") || status.includes("complete")
									? "bg-green-500 dark:bg-green-400"
									: status.includes("progress")
										? "bg-blue-500 dark:bg-blue-400"
										: "bg-gray-400 dark:bg-gray-500";

							return (
								<div
									key={task.id}
									className="flex items-center gap-3 cursor-pointer"
									onClick={() => {
										if (onEditTask) {
											onEditTask(task.task);
										}
									}}
								>
									<div className="w-56 truncate text-sm text-gray-800 dark:text-gray-100">
										<span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">
											{task.id}
										</span>
										{task.title}
									</div>
									<div className="flex-1 relative h-6">
										<div className="absolute inset-y-2 left-0 right-0 border-t border-dashed border-gray-200 dark:border-gray-700" />
										<div
											className={`absolute top-0 bottom-0 rounded-full ${color} shadow-sm`}
											style={{
												left: `${startOffset}%`,
												width: `${width}%`,
											}}
											title={`${formatDay(task.plannedStart)} → ${formatDay(task.plannedEnd)}`}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

export default GanttPage;
