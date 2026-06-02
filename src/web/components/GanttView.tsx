import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../../types";
import { useI18n } from "../hooks/useI18n";

const DAY = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 80;

export type Granularity = "day" | "week" | "month" | "quarter" | "year";

const GRANULARITY_CONFIG: Record<Granularity, {
	pxPerDay: number;
	minWidthPx: number;
	minDurationDays: number;
	columnWidth: number;
}> = {
	day: { pxPerDay: 90, minWidthPx: (90 / 24) * 4, minDurationDays: 4 / 24, columnWidth: 90 },
	week: { pxPerDay: 350 / 7, minWidthPx: 350 / 7, minDurationDays: 1, columnWidth: 350 },
	month: { pxPerDay: 350 / 30, minWidthPx: 350 / 30, minDurationDays: 1, columnWidth: 350 },
	quarter: { pxPerDay: 350 / 90, minWidthPx: 8, minDurationDays: 0, columnWidth: 350 },
	year: { pxPerDay: 350 / 365, minWidthPx: 8, minDurationDays: 0, columnWidth: 350 },
};

type GanttSortColumn = "id" | "title" | "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd";
type SortDirection = "asc" | "desc";

interface ParsedTask {
	id: string;
	title: string;
	start: Date;
	end: Date;
	originalStart?: string;
	originalEnd?: string;
	isFallback: boolean;
	plannedStart?: Date;
	plannedEnd?: Date;
	status: string;
	priority?: "high" | "medium" | "low";
	dependencies: string[];
	raw: Task;
}

interface TimelineColumn {
	start: Date;
	end: Date;
	middleLabel: string;
	topLabel: string;
	bottomTicks: Array<{ offsetPx: number; label: string }>;
}

interface GanttViewProps {
	tasks: Task[];
	onEditTask: (task: Task) => void;
}

function parseDate(dateStr?: string): Date | null {
	if (!dateStr) return null;
	const hasTime = dateStr.includes(" ");
	const iso = hasTime ? dateStr.replace(" ", "T") : `${dateStr}T00:00:00`;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

function parseTasks(tasks: Task[]): ParsedTask[] {
	return tasks.map((task) => {
		const plannedStart = parseDate(task.plannedStart);
		const plannedEnd = parseDate(task.plannedEnd);
		const actualStart = parseDate(task.actualStart);
		const actualEnd = parseDate(task.actualEnd);
		const created = parseDate(task.createdDate);
		const updated = parseDate(task.updatedDate);

		// Actual time resolution (for left table and actual bar)
		let start: Date;
		let originalStart: string | undefined;
		if (actualStart) {
			start = actualStart;
			originalStart = task.actualStart;
		} else if (created) {
			start = created;
			originalStart = task.createdDate;
		} else {
			start = new Date();
		}

		let end: Date;
		let originalEnd: string | undefined;
		let isFallback = false;
		if (actualEnd) {
			end = actualEnd;
			originalEnd = task.actualEnd;
		} else if (updated) {
			end = updated;
			originalEnd = task.updatedDate;
		} else if (created) {
			end = new Date(created.getTime() + DAY);
			isFallback = true;
			originalEnd = undefined;
		} else {
			end = new Date(start.getTime() + DAY);
			isFallback = true;
		}

		if (end.getTime() < start.getTime()) {
			end = new Date(start.getTime() + DAY);
			isFallback = true;
		}

		return {
			id: task.id,
			title: task.title,
			start,
			end,
			originalStart,
			originalEnd,
			isFallback,
			plannedStart: plannedStart ?? undefined,
			plannedEnd: plannedEnd ?? undefined,
			status: task.status,
			priority: task.priority,
			dependencies: task.dependencies ?? [],
			raw: task,
		};
	});
}

function formatShortDate(date: Date): string {
	return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDisplayDate(date: Date, showTime = true): string {
	const y = date.getFullYear();
	const m = date.getMonth() + 1;
	const d = date.getDate();
	const hh = date.getHours();
	const mm = date.getMinutes();
	const hasTime = hh !== 0 || mm !== 0;
	const now = new Date();
	let result: string;
	if (y === now.getFullYear()) {
		result = `${m}/${d}`;
	} else {
		result = `${y}/${m}/${d}`;
	}
	if (showTime && hasTime) {
		result += ` ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
	}
	return result;
}

function getWeekStart(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	const day = d.getDay();
	d.setDate(d.getDate() - day);
	return d;
}

function getWeekNumber(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil((((d.getTime() - yearStart.getTime()) / DAY) + 1) / 7);
}

function getQuarter(date: Date): number {
	return Math.floor(date.getMonth() / 3) + 1;
}

function getInitialViewRange(parsedTasks: ParsedTask[], granularity: Granularity): { start: Date; end: Date } {
	const unitMs: Record<Granularity, number> = {
		day: DAY,
		week: 7 * DAY,
		month: 30 * DAY,
		quarter: 90 * DAY,
		year: 365 * DAY,
	};
	const expand = 2 * unitMs[granularity];
	if (parsedTasks.length === 0) {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return { start: new Date(now.getTime() - expand), end: new Date(now.getTime() + expand) };
	}
	const minStart = new Date(Math.min(...parsedTasks.map((t) => t.start.getTime())));
	const maxEnd = new Date(Math.max(...parsedTasks.map((t) => t.end.getTime())));
	return { start: new Date(minStart.getTime() - expand), end: new Date(maxEnd.getTime() + expand) };
}

function getTimelineColumns(viewStart: Date, viewEnd: Date, granularity: Granularity): TimelineColumn[] {
	const columns: TimelineColumn[] = [];
	let current = new Date(viewStart);
	current.setHours(0, 0, 0, 0);

	switch (granularity) {
		case "day": {
			while (current.getTime() < viewEnd.getTime()) {
				const next = new Date(current.getTime() + DAY);
				const topLabel = `${current.getFullYear()}年${current.getMonth() + 1}月`;
				const cw = GRANULARITY_CONFIG.day.columnWidth;
				columns.push({
					start: current,
					end: next,
					middleLabel: `${current.getMonth() + 1}/${current.getDate()}`,
					topLabel,
					bottomTicks: [
						{ offsetPx: 0, label: "0" },
						{ offsetPx: cw * 0.25, label: "6" },
						{ offsetPx: cw * 0.5, label: "12" },
						{ offsetPx: cw * 0.75, label: "18" },
					],
				});
				current = next;
			}
			break;
		}
		case "week": {
			current = getWeekStart(current);
			while (current.getTime() < viewEnd.getTime()) {
				const next = new Date(current.getTime() + 7 * DAY);
				const weekNum = getWeekNumber(current);
				const startStr = formatShortDate(current);
				const endStr = formatShortDate(new Date(next.getTime() - DAY));
				const topLabel = `${current.getFullYear()}年${current.getMonth() + 1}月`;
				const bottomTicks: Array<{ offsetPx: number; label: string }> = [];
				for (let i = 0; i < 7; i++) {
					const d = new Date(current.getTime() + i * DAY);
					bottomTicks.push({ offsetPx: (i / 7) * GRANULARITY_CONFIG.week.columnWidth, label: `${d.getMonth() + 1}/${d.getDate()}` });
				}
				columns.push({
					start: current,
					end: next,
					middleLabel: `${weekNum}周(${startStr}-${endStr})`,
					topLabel,
					bottomTicks,
				});
				current = next;
			}
			break;
		}
		case "month": {
			current.setDate(1);
			while (current.getTime() < viewEnd.getTime()) {
				const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
				const daysInMonth = (next.getTime() - current.getTime()) / DAY;
				const topLabel = `${current.getFullYear()}年 第${getQuarter(current)}季度`;
				const bottomTicks: Array<{ offsetPx: number; label: string }> = [];
				for (const day of [1, 11, 21]) {
					if (day <= daysInMonth) {
						bottomTicks.push({ offsetPx: ((day - 1) / daysInMonth) * GRANULARITY_CONFIG.month.columnWidth, label: `${day}日` });
					}
				}
				columns.push({
					start: current,
					end: next,
					middleLabel: `${current.getMonth() + 1}月`,
					topLabel,
					bottomTicks,
				});
				current = next;
			}
			break;
		}
		case "quarter": {
			current.setDate(1);
			current.setMonth(Math.floor(current.getMonth() / 3) * 3);
			while (current.getTime() < viewEnd.getTime()) {
				const next = new Date(current.getFullYear(), current.getMonth() + 3, 1);
				const topLabel = `${current.getFullYear()}年`;
				const bottomTicks: Array<{ offsetPx: number; label: string }> = [];
				for (let i = 0; i < 3; i++) {
					const m = current.getMonth() + 1 + i;
					bottomTicks.push({ offsetPx: (i / 3) * GRANULARITY_CONFIG.quarter.columnWidth, label: `${m}月` });
				}
				columns.push({
					start: current,
					end: next,
					middleLabel: `Q${getQuarter(current)}`,
					topLabel,
					bottomTicks,
				});
				current = next;
			}
			break;
		}
		case "year": {
			current = new Date(current.getFullYear(), 0, 1);
			while (current.getTime() < viewEnd.getTime()) {
				const next = new Date(current.getFullYear() + 1, 0, 1);
				const bottomTicks: Array<{ offsetPx: number; label: string }> = [];
				for (let i = 0; i < 4; i++) {
					bottomTicks.push({ offsetPx: (i / 4) * GRANULARITY_CONFIG.year.columnWidth, label: `Q${i + 1}` });
				}
				columns.push({
					start: current,
					end: next,
					middleLabel: `${current.getFullYear()}年`,
					topLabel: "",
					bottomTicks,
				});
				current = next;
			}
			break;
		}
	}

	return columns;
}

function getTimelineX(date: Date, columns: TimelineColumn[], granularity: Granularity, snapToDay = false): number {
	const normalizedDate = new Date(date);
	if (snapToDay) normalizedDate.setHours(0, 0, 0, 0);
	let x = 0;
	for (const col of columns) {
		const colStart = new Date(col.start);
		if (snapToDay) colStart.setHours(0, 0, 0, 0);
		const colEnd = new Date(col.end);
		if (snapToDay) colEnd.setHours(0, 0, 0, 0);
		if (normalizedDate.getTime() >= colEnd.getTime()) {
			x += GRANULARITY_CONFIG[granularity].columnWidth;
		} else if (normalizedDate.getTime() >= colStart.getTime()) {
			const ratio = (normalizedDate.getTime() - colStart.getTime()) / (colEnd.getTime() - colStart.getTime());
			x += ratio * GRANULARITY_CONFIG[granularity].columnWidth;
			break;
		}
	}
	return x;
}

function extractTaskNumericId(taskId: string): number | null {
	const match = taskId.trim().match(/(\d+)$/);
	if (!match?.[1]) return null;
	return Number.parseInt(match[1], 10);
}

function compareTaskIds(a: ParsedTask, b: ParsedTask): number {
	const idA = extractTaskNumericId(a.id);
	const idB = extractTaskNumericId(b.id);
	if (idA !== null && idB !== null) return idA - idB;
	if (idA !== null) return -1;
	if (idB !== null) return 1;
	return a.id.localeCompare(b.id, undefined, { sensitivity: "base", numeric: true });
}

function getTaskStatusColor(status: string): string {
	switch (status?.toLowerCase()) {
		case "done":
		case "completed":
			return "bg-emerald-500";
		case "in progress":
			return "bg-blue-500";
		case "to do":
			return "bg-gray-400 dark:bg-gray-500";
		case "blocked":
			return "bg-red-500";
		case "cancelled":
			return "bg-gray-300 dark:bg-gray-600";
		default:
			return "bg-blue-400";
	}
}

export default function GanttView({ tasks, onEditTask }: GanttViewProps) {
	const { t } = useI18n();
	const [granularity, setGranularity] = useState<Granularity>("day");
	const [sortColumn, setSortColumn] = useState<GanttSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [showPlanTime, setShowPlanTime] = useState(false);
	const [showActualTime, setShowActualTime] = useState(true);
	const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
	const [viewStart, setViewStart] = useState<Date>(new Date());
	const [viewEnd, setViewEnd] = useState<Date>(new Date());
	const [isDragging, setIsDragging] = useState(false);
	const dragStartX = useRef(0);
	const viewStartAtDrag = useRef<Date>(new Date());
	const leftScrollRef = useRef<HTMLDivElement>(null);
	const timelineContainerRef = useRef<HTMLDivElement>(null);

	const parsedTasks = useMemo(() => parseTasks(tasks), [tasks]);
	const currentYear = new Date().getFullYear();
	const hasCrossYearTasks = useMemo(() => {
		return parsedTasks.some((task) => {
			const years = [
				task.plannedStart?.getFullYear(),
				task.plannedEnd?.getFullYear(),
				task.start.getFullYear(),
				task.end.getFullYear(),
			];
			return years.some((y) => y !== undefined && y !== currentYear);
		});
	}, [parsedTasks, currentYear]);

	const sortedTasks = useMemo(() => {
		const list = [...parsedTasks];
		list.sort((a, b) => {
			let cmp = 0;
			switch (sortColumn) {
				case "id":
					cmp = compareTaskIds(a, b);
					break;
				case "title":
					cmp = a.title.localeCompare(b.title);
					break;
				case "plannedStart":
					cmp = (a.plannedStart?.getTime() ?? 0) - (b.plannedStart?.getTime() ?? 0);
					break;
				case "plannedEnd":
					cmp = (a.plannedEnd?.getTime() ?? 0) - (b.plannedEnd?.getTime() ?? 0);
					break;
				case "actualStart":
					cmp = a.start.getTime() - b.start.getTime();
					break;
				case "actualEnd":
					cmp = a.end.getTime() - b.end.getTime();
					break;
			}
			return sortDirection === "asc" ? cmp : -cmp;
		});
		return list;
	}, [parsedTasks, sortColumn, sortDirection]);

	const leftPanelWidth = useMemo(() => {
		const base = hasCrossYearTasks ? 320 : 368;
		const planWidth = hasCrossYearTasks ? 192 : 160;
		const actualWidth = hasCrossYearTasks ? 352 : 256;
		return base + (showPlanTime ? planWidth : 0) + (showActualTime ? actualWidth : 0);
	}, [showPlanTime, showActualTime, hasCrossYearTasks]);

	useEffect(() => {
		const range = getInitialViewRange(sortedTasks, granularity);
		setViewStart(range.start);
		setViewEnd(range.end);
	}, [sortedTasks, granularity]);

	const hasAutoSelected = useRef(false);
	useEffect(() => {
		if (!hasAutoSelected.current && sortedTasks.length > 0 && !selectedTaskId) {
			setSelectedTaskId(sortedTasks[0]?.id ?? null);
			hasAutoSelected.current = true;
		}
	}, [sortedTasks, selectedTaskId]);

	const config = GRANULARITY_CONFIG[granularity];
	const columns = useMemo(() => getTimelineColumns(viewStart, viewEnd, granularity), [viewStart, viewEnd, granularity]);
	const timelineWidth = columns.length * config.columnWidth;

	const taskPositions = useMemo(() => {
		const positions: Record<string, { x: number; y: number; width: number }> = {};
		sortedTasks.forEach((task) => {
			const x = getTimelineX(task.start, columns, granularity, false);
			const endX = getTimelineX(task.end, columns, granularity, false);
			const rawWidth = endX - x;
			const width = task.isFallback ? Math.max(rawWidth, config.minWidthPx) : Math.max(rawWidth, 4);
			const y = HEADER_HEIGHT + sortedTasks.indexOf(task) * ROW_HEIGHT;
			positions[task.id] = { x, y, width };
		});
		return positions;
	}, [sortedTasks, columns, granularity, config]);

	const planPositions = useMemo(() => {
		const positions: Record<string, { x: number; y: number; width: number } | null> = {};
		sortedTasks.forEach((task) => {
			if (!task.plannedStart || !task.plannedEnd) {
				positions[task.id] = null;
				return;
			}
			const x = getTimelineX(task.plannedStart, columns, granularity, true);
			const endX = getTimelineX(task.plannedEnd, columns, granularity, true);
			const rawWidth = endX - x;
			const width = Math.max(rawWidth, 2);
			const y = HEADER_HEIGHT + sortedTasks.indexOf(task) * ROW_HEIGHT;
			positions[task.id] = { x, y, width };
		});
		return positions;
	}, [sortedTasks, columns, granularity, config]);

	const scrollToTask = useCallback((taskId: string) => {
		const pos = taskPositions[taskId];
		if (pos && timelineContainerRef.current) {
			const container = timelineContainerRef.current;
			const targetScrollLeft = pos.x + pos.width / 2 - container.clientWidth / 2;
			container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: "smooth" });
		}
	}, [taskPositions]);

	useEffect(() => {
		if (selectedTaskId) {
			scrollToTask(selectedTaskId);
		}
	}, [selectedTaskId, granularity, scrollToTask]);

	const highlightedIds = useMemo(() => {
		if (!selectedTaskId) return new Set<string>();
		const ids = new Set<string>();
		ids.add(selectedTaskId);
		const task = sortedTasks.find((t) => t.id === selectedTaskId);
		if (task) {
			for (const depId of task.dependencies) ids.add(depId);
		}
		for (const t of sortedTasks) {
			if (t.dependencies.includes(selectedTaskId)) ids.add(t.id);
		}
		return ids;
	}, [selectedTaskId, sortedTasks]);

	const handleSortChange = useCallback((column: GanttSortColumn) => {
		setSortColumn((prev) => {
			if (prev === column) {
				setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
				return prev;
			}
			setSortDirection(column === "id" ? "desc" : "asc");
			return column;
		});
	}, []);

	const getSortAriaValue = useCallback((column: GanttSortColumn): "none" | "ascending" | "descending" => {
		if (sortColumn !== column) return "none";
		return sortDirection === "asc" ? "ascending" : "descending";
	}, [sortColumn, sortDirection]);

	const renderSortIcon = useCallback((column: GanttSortColumn) => {
		const isActive = sortColumn === column;
		const isAsc = sortDirection === "asc";
		return (
			<span className="inline-flex items-center justify-center w-4 text-xs select-none" aria-hidden="true">
				<span className={isActive && isAsc ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"}>↑</span>
				<span className={isActive && !isAsc ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"}>↓</span>
			</span>
		);
	}, [sortColumn, sortDirection]);

	const renderSortableHeader = useCallback((label: string, column: GanttSortColumn, widthClass: string) => (
		<th className={`px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${widthClass}`} style={{ height: HEADER_HEIGHT }} aria-sort={getSortAriaValue(column)}>
			<div className="h-full flex items-end pb-2">
				<button type="button" onClick={() => handleSortChange(column)} className="inline-flex flex-row items-center hover:text-gray-700 dark:hover:text-gray-100 leading-tight whitespace-pre-line gap-1">
					{label}
					{renderSortIcon(column)}
				</button>
			</div>
		</th>
	), [handleSortChange, getSortAriaValue, renderSortIcon]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if ((e.target as HTMLElement).closest("[data-task-bar]")) return;
		setIsDragging(true);
		dragStartX.current = e.clientX;
		viewStartAtDrag.current = new Date(viewStart.getTime());
	}, [viewStart]);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (!isDragging) return;
		const deltaX = e.clientX - dragStartX.current;
		const pxPerDay = config.pxPerDay;
		const deltaDays = deltaX / pxPerDay;
		const newStart = new Date(viewStartAtDrag.current.getTime() - deltaDays * DAY);
		const rangeMs = viewEnd.getTime() - viewStart.getTime();
		setViewStart(newStart);
		setViewEnd(new Date(newStart.getTime() + rangeMs));
	}, [isDragging, config.pxPerDay, viewEnd, viewStart]);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	useEffect(() => {
		if (!isDragging) return;
		const handleGlobalMouseUp = () => setIsDragging(false);
		document.addEventListener("mouseup", handleGlobalMouseUp);
		return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
	}, [isDragging]);

	// Sync vertical scroll between left table and right timeline
	useEffect(() => {
		const left = leftScrollRef.current;
		const right = timelineContainerRef.current;
		if (!left || !right) return;

		const syncFromLeft = () => { right.scrollTop = left.scrollTop; };
		const syncFromRight = () => { left.scrollTop = right.scrollTop; };

		left.addEventListener("scroll", syncFromLeft);
		right.addEventListener("scroll", syncFromRight);
		return () => {
			left.removeEventListener("scroll", syncFromLeft);
			right.removeEventListener("scroll", syncFromRight);
		};
	}, []);

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayX = getTimelineX(today, columns, granularity);
	const showTodayLine = todayX >= 0 && todayX <= timelineWidth;

	const granularityButtons: { key: Granularity; label: string }[] = [
		{ key: "day", label: (t as any).gantt?.granularity?.day ?? "日" },
		{ key: "week", label: (t as any).gantt?.granularity?.week ?? "周" },
		{ key: "month", label: (t as any).gantt?.granularity?.month ?? "月" },
		{ key: "quarter", label: (t as any).gantt?.granularity?.quarter ?? "季" },
		{ key: "year", label: (t as any).gantt?.granularity?.year ?? "年" },
	];

	return (
		<>
			<style>{"\n\t\t\t\t.gantt-hide-scrollbar::-webkit-scrollbar { display: none; }\n\t\t\t"}</style>
			<div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors duration-200">
					{/* Toolbar */}
					<div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 gap-4">
						<div className="flex items-center gap-4">
							<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
								{(t as any).gantt?.title ?? "Gantt"}
							</h2>
							<div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
								{granularityButtons.map((btn) => (
									<button
										key={btn.key}
										type="button"
										onClick={() => setGranularity(btn.key)}
										className={`px-3 py-1 text-sm rounded-md transition-colors ${
											granularity === btn.key
												? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium"
												: "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
										}`}
									>
										{btn.label}
									</button>
								))}
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
							{Array.from(
								tasks.reduce((map, task) => {
									const lower = task.status.toLowerCase();
									if (!map.has(lower)) map.set(lower, task.status);
									return map;
								}, new Map<string, string>()),
							).map(([lower, original]) => (
								<div key={lower} className="flex items-center gap-1">
									<div className={`w-4 h-3 rounded-sm ${getTaskStatusColor(lower)}`} />
									<span>{original}</span>
								</div>
							))}
							<div className="flex items-center gap-1">
								<div className="w-4 h-3 border border-gray-400 dark:border-white rounded-sm" style={{ backgroundImage: "repeating-linear-gradient(-60deg, transparent, transparent 2px, rgba(128,128,128,0.18) 2px, rgba(128,128,128,0.18) 3px)", backgroundSize: "4px 4px" }} />
								<span>{(t as any).gantt?.legend?.planned ?? "Planned"}</span>
							</div>
							<div className="flex items-center gap-1">
								<svg width="16" height="10" className="text-gray-500 dark:text-gray-400">
									<line x1="0" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" />
									<polygon points="12,5 8,3 8,7" fill="currentColor" />
								</svg>
								<span>{(t as any).gantt?.legend?.dependency ?? "Dependency"}</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="text-amber-600 dark:text-amber-400 font-bold">*</span>
								<span>{(t as any).gantt?.legend?.fallback ?? "Fallback"}</span>
							</div>
						</div>
					</div>


				{/* Main content */}
				<div className="flex flex-1 overflow-hidden">
					{/* Left panel: task list */}
					<div
						ref={leftScrollRef}
						className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto gantt-hide-scrollbar"
						style={{ width: leftPanelWidth, scrollbarWidth: "none" }}
					>
						<table className="w-full text-left border-collapse table-fixed">
							<thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10 relative" style={{ height: HEADER_HEIGHT }}>
								<div className="absolute top-2 left-2 flex items-center gap-3 z-20">
									<label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300 cursor-pointer select-none whitespace-nowrap">
										<input
											type="checkbox"
											checked={showPlanTime}
											onChange={(e) => setShowPlanTime(e.target.checked)}
											className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
										/>
										{(t as any).gantt?.showPlanTime ?? "Show Plan Time"}
									</label>
									<label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300 cursor-pointer select-none whitespace-nowrap">
										<input
											type="checkbox"
											checked={showActualTime}
											onChange={(e) => setShowActualTime(e.target.checked)}
											className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
										/>
										{(t as any).gantt?.showActualTime ?? "Show Actual Time"}
									</label>
								</div>
								<tr className="border-b border-gray-200 dark:border-gray-700" style={{ height: HEADER_HEIGHT }}>
									{renderSortableHeader((t as any).gantt?.columns?.id ?? "ID", "id", "w-24")}
									{renderSortableHeader((t as any).gantt?.columns?.title ?? "Title", "title", "")}
									{showPlanTime && renderSortableHeader((t as any).gantt?.columns?.plannedStart ?? "Plan Start", "plannedStart", hasCrossYearTasks ? "w-24" : "w-20")}
									{showPlanTime && renderSortableHeader((t as any).gantt?.columns?.plannedEnd ?? "Plan End", "plannedEnd", hasCrossYearTasks ? "w-24" : "w-20")}
									{showActualTime && renderSortableHeader((t as any).gantt?.columns?.actualStart ?? "Actual Start", "actualStart", hasCrossYearTasks ? "w-44" : "w-32")}
									{showActualTime && renderSortableHeader((t as any).gantt?.columns?.actualEnd ?? "Actual End", "actualEnd", hasCrossYearTasks ? "w-44" : "w-32")}
									<th className="px-2 w-20 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ height: HEADER_HEIGHT }}>
										<div className="h-full flex items-end pb-2">
											{(t as any).gantt?.columns?.action ?? "Action"}
										</div>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
								{sortedTasks.map((task) => (
									<tr
										key={task.id}
										className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
											selectedTaskId === task.id ? "bg-blue-100 dark:bg-blue-900/40" : ""
										}`}
										onClick={() => {
											setSelectedTaskId((prev) => (prev === task.id ? null : task.id));
											scrollToTask(task.id);
										}}
									>
										<td className="px-2 h-10 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap w-24">
											{task.id}
										</td>
										<td className="px-2 h-10 text-sm text-gray-700 dark:text-gray-300 truncate" title={task.title}>
											{task.title}
										</td>
										{showPlanTime && (
											<React.Fragment>
												<td className={`px-2 h-10 text-sm text-gray-600 dark:text-gray-400 truncate ${hasCrossYearTasks ? "w-24" : "w-20"}`}>
													{task.plannedStart ? formatDisplayDate(task.plannedStart, false) : "-"}
												</td>
												<td className={`px-2 h-10 text-sm text-gray-600 dark:text-gray-400 truncate ${hasCrossYearTasks ? "w-24" : "w-20"}`}>
													{task.plannedEnd ? formatDisplayDate(task.plannedEnd, false) : "-"}
												</td>
											</React.Fragment>
										)}
											{showActualTime && (
												<React.Fragment>
													<td className={`px-2 h-10 text-sm text-gray-600 dark:text-gray-400 truncate ${hasCrossYearTasks ? "w-44" : "w-32"}`}>
														{task.raw.actualStart ? formatDisplayDate(task.start) : (
															<span className="text-amber-600 dark:text-amber-400">{formatDisplayDate(task.start)} *</span>
														)}
													</td>
													<td className={`px-2 h-10 text-sm text-gray-600 dark:text-gray-400 truncate ${hasCrossYearTasks ? "w-44" : "w-32"}`}>
														{task.raw.actualEnd ? formatDisplayDate(task.end) : (
															<span className="text-amber-600 dark:text-amber-400">{formatDisplayDate(task.end)} *</span>
														)}
													</td>
												</React.Fragment>
											)}
										<td className="px-2 h-10 whitespace-nowrap w-20">
											<button
												type="button"
												className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
												onClick={(e) => {
													e.stopPropagation();
													onEditTask(task.raw);
												}}
											>
												{(t as any).gantt?.action?.detail ?? "Detail"}
											</button>
										</td>
									</tr>
								))}
								{sortedTasks.length === 0 && (
									<tr>
										<td colSpan={5} className="px-4 h-10 text-center text-gray-500 dark:text-gray-400 text-sm w-full">
											{(t as any).gantt?.noTasks ?? "No tasks to display"}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{/* Right panel: timeline */}
					<div
						ref={timelineContainerRef}
						className="flex-1 overflow-auto relative select-none"
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						style={{ cursor: isDragging ? "grabbing" : "grab" }}
					>
						<div className="relative" style={{ width: timelineWidth, height: HEADER_HEIGHT + Math.max(sortedTasks.length * ROW_HEIGHT, 200) }}>
							{/* Timeline header - three-level ticks */}
							<div className="sticky top-0 left-0 bg-gray-50 dark:bg-gray-800 z-20 border-b border-gray-200 dark:border-gray-700 flex flex-col" style={{ height: HEADER_HEIGHT }}>
								{/* Layer 1: group labels */}
								<div className="h-[20px] flex relative border-b border-gray-100 dark:border-gray-700/50">
									{(() => {
										const groups: Array<{ label: string; start: number; width: number }> = [];
										let cur: { label: string; start: number; width: number } | null = null;
										columns.forEach((col, idx) => {
											const prevTop = idx > 0 ? columns[idx - 1]?.topLabel : null;
											if (col.topLabel !== prevTop || !cur) {
												if (cur) groups.push(cur);
												cur = { label: col.topLabel, start: idx * config.columnWidth, width: config.columnWidth };
											} else {
												cur.width += config.columnWidth;
											}
										});
										if (cur) groups.push(cur);
										return (
											<>
												{groups.map((g, i) => (
													g.label && (
															<div key={i} className="absolute top-0 bottom-0 flex items-center justify-center text-[10px] text-gray-500 dark:text-gray-400 font-medium text-center truncate px-1" style={{ left: g.start, width: g.width }}>
																{g.label}
															</div>
														)
													))}
													{columns.map((col, idx) => {
														const prevTop = idx > 0 ? columns[idx - 1]?.topLabel : null;
														const showTop = col.topLabel && col.topLabel !== prevTop;
														return showTop && idx > 0 ? (
															<div key={idx} className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500" style={{ left: idx * config.columnWidth }} />
														) : null;
													})}
												</>
											);
										})()}
								</div>
								{/* Layer 2: column labels */}
								<div className="h-[30px] flex border-b border-gray-100 dark:border-gray-700/50">
									{columns.map((col) => (
										<div
											key={`m-${col.start.getTime()}`}
											className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center text-[11px] text-gray-700 dark:text-gray-300 font-medium text-center truncate px-1"
											style={{ width: config.columnWidth }}
										>
											{col.middleLabel}
										</div>
									))}
								</div>
								{/* Layer 3: bottom ticks */}
								<div className="h-[30px] flex">
									{columns.map((col) => (
										<div
											key={`b-${col.start.getTime()}`}
											className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 relative"
											style={{ width: config.columnWidth }}
										>
											{col.bottomTicks.map((tick) => (
												<div
													key={tick.offsetPx}
													className="absolute bottom-0 border-l border-gray-300 dark:border-gray-600"
													style={{ left: tick.offsetPx, height: 6 }}
												>
														<span className="absolute -top-3 left-0 text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
															{tick.label}
														</span>
													</div>
											))}
										</div>
									))}
								</div>
							</div>
							{/* Today line */}
							{showTodayLine && (
								<div
									className="absolute bottom-0 border-l-2 border-red-400 dark:border-red-500 z-10 pointer-events-none"
										style={{ top: HEADER_HEIGHT, left: todayX }}
								>
									<span className="absolute top-0 -translate-x-1/2 text-[10px] text-red-500 dark:text-red-400 bg-white dark:bg-gray-900 px-1">
										{(t as any).gantt?.today ?? "Today"}
									</span>
								</div>
							)}

							{/* Grid lines */}						{Array.from({ length: sortedTasks.length + 1 }).map((_, i) => (
								<div
									key={`grid-${i}`}
									className="absolute left-0 right-0 border-b border-gray-100 dark:border-gray-800"
									style={{ top: HEADER_HEIGHT + i * ROW_HEIGHT }}
								/>
							))}

							{/* Actual task bars (bottom layer) */}
							{sortedTasks.map((task) => {
								const pos = taskPositions[task.id];
								if (!pos) return null;
								const isHighlighted = highlightedIds.has(task.id);
								const isDimmed = selectedTaskId && !isHighlighted;
								const isHovered = hoveredTaskId === task.id;
								const barTop = pos.y + (ROW_HEIGHT - 24) / 2;

								return (
									<div
										key={`actual-${task.id}`}
										data-task-bar
										className={`absolute h-6 rounded transition-all duration-200 cursor-pointer ${
											getTaskStatusColor(task.status)
										} ${isDimmed ? "opacity-30" : isHighlighted ? "opacity-100" : "opacity-90"} ${
											isHovered ? "ring-2 ring-white dark:ring-gray-700 z-20" : ""
										}`}
										style={{
											left: pos.x,
											top: barTop,
											width: Math.max(pos.width, 2),
											minWidth: 2,
										}}
										onMouseEnter={(e) => {
											setHoveredTaskId(task.id);
											const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
											setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
										}}
										onMouseLeave={() => {
											setHoveredTaskId(null);
											setTooltipPos(null);
										}}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedTaskId((prev) => (prev === task.id ? null : task.id));
										}}
									>
										{pos.width > 60 && (
											<span className="text-[10px] text-white font-medium truncate px-1.5 leading-6 block">
												{task.id}
											</span>
										)}
									</div>
								);
							})}

							{/* Plan border bars (top layer) */}
							{sortedTasks.map((task) => {
								const planPos = planPositions[task.id];
								if (!planPos) return null;
								const isHighlighted = highlightedIds.has(task.id);
								const isDimmed = selectedTaskId && !isHighlighted;
								const barTop = planPos.y + (ROW_HEIGHT - 24) / 2;
								const hatch = "repeating-linear-gradient(-60deg, transparent, transparent 4px, rgba(128,128,128,0.18) 4px, rgba(128,128,128,0.18) 5px)";

								return (
									<div
										key={`plan-${task.id}`}
										className={`absolute h-6 rounded-md pointer-events-none border-2 border-white dark:border-gray-500 ${
											isDimmed ? "opacity-20" : isHighlighted ? "opacity-100" : "opacity-80"
										}`}
										style={{
											left: planPos.x,
											top: barTop,
											width: Math.max(planPos.width, 2),
											minWidth: 2,
											backgroundImage: hatch,
											backgroundSize: "6px 6px",
										}}
									>
										<div
											className="absolute inset-0 rounded-md border border-gray-400 dark:border-white"
											style={{
												backgroundImage: hatch,
												backgroundSize: "6px 6px",
											}}
										/>
									</div>
								);
							})}

							{/* Dependency arrows */}
							<svg
								className="absolute inset-0 pointer-events-none"
								style={{ width: timelineWidth, height: HEADER_HEIGHT + Math.max(sortedTasks.length * ROW_HEIGHT, 200) }}
							>
								{sortedTasks.map((task) =>
									task.dependencies.map((depId) => {
										const fromTask = sortedTasks.find((t) => t.id === depId);
										const toTask = task;
										if (!fromTask || !toTask) return null;

										const fromPos = taskPositions[depId];
										const toPos = taskPositions[task.id];
										if (!fromPos || !toPos) return null;

										// Resolve arrow start point (from task's end side)
										let startX: number;
										if (fromTask.plannedStart && fromTask.end.getTime() < fromTask.plannedStart.getTime()) {
											startX = fromTask.plannedEnd ? getTimelineX(fromTask.plannedEnd, columns, granularity) : fromPos.x + fromPos.width;
										} else {
											startX = fromPos.x + fromPos.width;
										}

										// Resolve arrow end point (to task's start side)
										let endX: number;
										if (toTask.plannedStart && toTask.start.getTime() < toTask.plannedStart.getTime()) {
											endX = toPos.x;
										} else {
											endX = toTask.plannedStart ? getTimelineX(toTask.plannedStart, columns, granularity) : toPos.x;
										}

										const startY = fromPos.y + ROW_HEIGHT / 2;
										const endY = toPos.y + ROW_HEIGHT / 2;
										const HSEG = 6;
										const ARROW_SIZE = 6;
										const p0x = startX + HSEG;
										const p3x = endX - HSEG;
										const segDx = p3x - p0x;
										const CURVE = Math.max(Math.abs(segDx) * 0.5, HSEG * 6);
										const cp1x = p0x + CURVE;
										const cp2x = p3x - CURVE;
										const pathD = `M ${startX} ${startY} L ${p0x} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${p3x} ${endY}`;

										const arrowBaseX = endX - ARROW_SIZE;
										const arrowPoints = `${endX},${endY} ${arrowBaseX},${endY - 2.5} ${arrowBaseX},${endY + 2.5}`;

										const isHighlighted = selectedTaskId && (selectedTaskId === task.id || selectedTaskId === depId);
										const isDimmed = selectedTaskId && !isHighlighted;
										const colorClass = isHighlighted
											? "stroke-blue-500 dark:stroke-blue-400"
											: "stroke-gray-500 dark:stroke-gray-400";
										const fillClass = isHighlighted
											? "fill-blue-500 dark:fill-blue-400"
											: "fill-gray-500 dark:fill-gray-400";
										const opacityClass = isDimmed ? "opacity-20" : isHighlighted ? "opacity-100" : "opacity-70";

										return (
											<g key={`${depId}-${task.id}`} className={opacityClass}>
												<path d={pathD} fill="none" className={colorClass} strokeWidth="1.5" />
												<polygon points={arrowPoints} className={fillClass} />
											</g>
										);
									}),
								)}
							</svg>
						</div>
					</div>
				</div>

				{/* Tooltip */}
				{hoveredTaskId && tooltipPos && (
					<div
						className="fixed z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none max-w-xs"
						style={{ left: tooltipPos.x, top: tooltipPos.y - 8, transform: "translate(-50%, -100%)" }}
					>
						{(() => {
							const task = sortedTasks.find((t) => t.id === hoveredTaskId);
							if (!task) return null;
							return (
								<div className="space-y-0.5">
									<div className="font-semibold">{task.id} - {task.title}</div>
											{task.plannedStart && task.plannedEnd && (
												<div className="text-gray-300">
													{(t as any).gantt?.tooltip?.planned ?? "Planned"}: {formatDisplayDate(task.plannedStart, false)} → {formatDisplayDate(task.plannedEnd, false)}
												</div>
											)}
											<div>
												{(t as any).gantt?.tooltip?.actual ?? "Actual"}: {formatDisplayDate(task.start)} → {formatDisplayDate(task.end)}
												{task.isFallback && ` [${(t as any).gantt?.tooltip?.fallback ?? "fallback"}]`}
											</div>
								</div>
							);
						})()}
					</div>
				)}
			</div>
		</>
	);
}
