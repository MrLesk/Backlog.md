import React, { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/api";
import { buildMilestoneBuckets } from "../utils/milestones";
import { type Milestone, type MilestoneBucket, type Task } from "../../types";
import Modal from "./Modal";

interface MilestonesPageProps {
	tasks: Task[];
	statuses: string[];
	milestones: string[];
	milestoneEntities: Milestone[];
	onEditTask: (task: Task) => void;
	onRefreshData?: () => Promise<void>;
}

const MilestonesPage: React.FC<MilestonesPageProps> = ({
	tasks,
	statuses,
	milestones,
	milestoneEntities,
	onEditTask,
	onRefreshData,
}) => {
	const [newMilestone, setNewMilestone] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});
	const [draggedTask, setDraggedTask] = useState<Task | null>(null);
	const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
	const [showAllUnassigned, setShowAllUnassigned] = useState(false);

	const buckets = useMemo(() => buildMilestoneBuckets(tasks, milestoneEntities, statuses), [tasks, milestoneEntities, statuses]);

	// Separate buckets into categories and sort by ID descending
	const { unassignedBucket, allMilestones } = useMemo(() => {
		// Sort milestones by ID descending (newest first - IDs are sequential m-0, m-1, etc.)
		const sortByIdDesc = (a: MilestoneBucket, b: MilestoneBucket) => {
			const aMilestone = a.milestone ?? "";
			const bMilestone = b.milestone ?? "";
			const aMatch = aMilestone.match(/^m-(\d+)/);
			const bMatch = bMilestone.match(/^m-(\d+)/);
			const aNum = aMatch?.[1] ? Number.parseInt(aMatch[1], 10) : -1;
			const bNum = bMatch?.[1] ? Number.parseInt(bMatch[1], 10) : -1;
			return bNum - aNum;
		};

		const unassigned = buckets.find((b) => b.isNoMilestone);
		const active = buckets.filter((b) => !b.isNoMilestone && b.total > 0);
		const empty = buckets.filter((b) => !b.isNoMilestone && b.total === 0);

		// Sort each group by ID descending, then combine (active with tasks first, then empty)
		const sortedActive = [...active].sort(sortByIdDesc);
		const sortedEmpty = [...empty].sort(sortByIdDesc);

		return {
			unassignedBucket: unassigned,
			allMilestones: [...sortedActive, ...sortedEmpty],
		};
	}, [buckets]);

	// Drag and drop handlers
	const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
		setDraggedTask(task);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", task.id);
		// Add dragging class for visual feedback
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "0.5";
		}
	}, []);

	const handleDragEnd = useCallback((e: React.DragEvent) => {
		setDraggedTask(null);
		setDropTargetKey(null);
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "1";
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, bucketKey: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDropTargetKey(bucketKey);
	}, []);

	const handleDragLeave = useCallback(() => {
		setDropTargetKey(null);
	}, []);

	const handleDrop = useCallback(async (e: React.DragEvent, targetMilestone: string | undefined) => {
		e.preventDefault();
		setDropTargetKey(null);

		if (!draggedTask) return;

		// Don't do anything if dropping on same milestone
		if (draggedTask.milestone === targetMilestone) {
			setDraggedTask(null);
			return;
		}

		try {
			await apiClient.updateTask(draggedTask.id, { milestone: targetMilestone });
			if (onRefreshData) {
				await onRefreshData();
			}
		} catch (err) {
			console.error("Failed to update task milestone:", err);
		}

		setDraggedTask(null);
	}, [draggedTask, onRefreshData]);

	const handleNewMilestoneChange = (value: string) => {
		setNewMilestone(value);
		if (error) setError(null);
		if (success) setSuccess(null);
	};

	const closeAddModal = () => {
		setShowAddModal(false);
		setNewMilestone("");
		setError(null);
	};

	const handleAddMilestone = async (event?: React.FormEvent<HTMLFormElement>) => {
		event?.preventDefault();
		const value = newMilestone.trim();
		if (!value) {
			setError("Milestone name cannot be empty.");
			setSuccess(null);
			return;
		}

		setIsSaving(true);
		setError(null);
		setSuccess(null);
		try {
			await apiClient.createMilestone(value);
			setNewMilestone("");
			setSuccess(`Added milestone "${value}"`);
			setShowAddModal(false);
			if (onRefreshData) {
				await onRefreshData();
			}
			setTimeout(() => setSuccess(null), 3000);
		} catch (err) {
			console.error("Failed to add milestone:", err);
			setError(err instanceof Error ? err.message : "Failed to add milestone.");
		} finally {
			setIsSaving(false);
		}
	};

	const isDoneStatus = (status?: string | null) => {
		const normalized = (status ?? "").toLowerCase();
		return normalized.includes("done") || normalized.includes("complete");
	};

	const getStatusBadgeClass = (status?: string | null) => {
		const normalized = (status ?? "").toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) {
			return "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300";
		}
		if (normalized.includes("progress")) {
			return "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300";
		}
		return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
	};

	const getPriorityBadgeClass = (priority?: string) => {
		switch (priority?.toLowerCase()) {
			case "high":
				return "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300";
			case "medium":
				return "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300";
			case "low":
				return "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300";
			default:
				return "";
		}
	};

	const getStatusDotColor = (status?: string | null) => {
		const normalized = (status ?? "").toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) return "#10b981";
		if (normalized.includes("progress")) return "#3b82f6";
		return "#6b7280";
	};

	const getInlineStatusClass = (status: string) => {
		const normalized = status.toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) return "text-emerald-700 dark:text-emerald-300";
		if (normalized.includes("progress")) return "text-blue-700 dark:text-blue-300";
		return "text-gray-600 dark:text-gray-400";
	};

	const getSortedTasks = (bucketTasks: Task[]) => {
		return bucketTasks.slice().sort((a, b) => {
			// Done tasks go to the bottom
			const aDone = isDoneStatus(a.status);
			const bDone = isDoneStatus(b.status);
			if (aDone !== bDone) return aDone ? 1 : -1;
			// Sort by created date descending (newest first)
			const aDate = a.createdDate ?? "";
			const bDate = b.createdDate ?? "";
			return bDate.localeCompare(aDate);
		});
	};

	const safeIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");

	// Drag handle icon component
	const DragHandle = () => (
		<svg className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" viewBox="0 0 24 24" fill="currentColor">
			<circle cx="9" cy="6" r="1.5" />
			<circle cx="15" cy="6" r="1.5" />
			<circle cx="9" cy="12" r="1.5" />
			<circle cx="15" cy="12" r="1.5" />
			<circle cx="9" cy="18" r="1.5" />
			<circle cx="15" cy="18" r="1.5" />
		</svg>
	);

	// Render a milestone card (drop target)
	const renderMilestoneCard = (bucket: MilestoneBucket, isEmpty: boolean) => {
		const progress = bucket.total > 0 ? Math.round((bucket.doneCount / bucket.total) * 100) : 0;
		const defaultExpanded = bucket.total > 0 && bucket.total <= 8;
		const isExpanded = expandedBuckets[bucket.key] ?? defaultExpanded;
		const listId = `milestone-${safeIdSegment(bucket.key)}`;
		const sortedTasks = getSortedTasks(bucket.tasks);
		const isDropTarget = dropTargetKey === bucket.key;
		const isDragging = draggedTask !== null;

		return (
			<div
				key={bucket.key}
				className={`rounded-lg border-2 transition-all duration-200 ${
					isDropTarget
						? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]"
						: isDragging
						? "border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
						: "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
				}`}
				onDragOver={(e) => handleDragOver(e, bucket.key)}
				onDragLeave={handleDragLeave}
				onDrop={(e) => handleDrop(e, bucket.milestone)}
			>
				<div className="px-5 py-4">
					{/* Header row */}
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
							{bucket.label}
						</h3>
						{isEmpty ? (
							<span className="text-sm text-gray-400 dark:text-gray-500">
								{isDragging ? "Drop here" : "No tasks"}
							</span>
						) : (
							<div className="flex items-center gap-3">
								<span className="text-sm text-gray-500 dark:text-gray-400">
									{bucket.total} task{bucket.total === 1 ? "" : "s"}
								</span>
								<span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
									{progress}%
								</span>
							</div>
						)}
					</div>

					{/* Progress bar - only for non-empty */}
					{!isEmpty && (
						<div className="mt-3 w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
							<div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
						</div>
					)}

					{/* Status breakdown - only for non-empty */}
					{!isEmpty && (
						<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
							{statuses.map((status) => {
								const count = bucket.statusCounts[status] ?? 0;
								if (count === 0) return null;
								return (
									<span key={status} className={`inline-flex items-center gap-1.5 ${getInlineStatusClass(status)}`}>
										<span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusDotColor(status) }} />
										{count} {status}
									</span>
								);
							})}
						</div>
					)}

					{/* Actions - only for non-empty milestones */}
					{!isEmpty && (
						<div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
							<div className="flex items-center gap-2">
								<Link
									to={`/?lane=milestone&milestone=${encodeURIComponent(bucket.milestone ?? "")}`}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
								>
									<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
									</svg>
									Board
								</Link>
								<Link
									to={`/tasks?milestone=${encodeURIComponent(bucket.milestone ?? "")}`}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
								>
									<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
									</svg>
									List
								</Link>
							</div>
							<button
								type="button"
								aria-expanded={isExpanded}
								aria-controls={listId}
								onClick={() => setExpandedBuckets((c) => ({ ...c, [bucket.key]: !isExpanded }))}
								className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
							>
								{isExpanded ? "Hide" : "Show"} tasks
								<svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
								</svg>
							</button>
						</div>
					)}

					{/* Task list */}
					{isExpanded && !isEmpty && (
						<div id={listId} className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
							<div className="divide-y divide-gray-200 dark:divide-gray-700">
								{sortedTasks.slice(0, 10).map((task) => {
									const done = isDoneStatus(task.status);
									return (
										<div
											key={task.id}
											draggable
											onDragStart={(e) => handleDragStart(e, task)}
											onDragEnd={handleDragEnd}
											onClick={() => onEditTask(task)}
											className="group flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
										>
											<div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
												<DragHandle />
											</div>
											<span className={`flex-1 flex items-center gap-2 min-w-0 ${done ? "text-gray-400" : ""}`}>
												<span className={`text-sm truncate ${done ? "" : "text-gray-900 dark:text-gray-100"}`}>{task.title}</span>
												<span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{task.id}</span>
											</span>
											{task.priority && (
												<span className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span>
											)}
											<svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
											</svg>
										</div>
									);
								})}
							</div>
							{sortedTasks.length > 10 && (
								<div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
									<Link to={`/tasks?milestone=${encodeURIComponent(bucket.milestone ?? "")}`} className="text-blue-600 dark:text-blue-400 hover:underline">
										View all {sortedTasks.length} tasks →
									</Link>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		);
	};

	// Render unassigned tasks section with table layout
	const renderUnassignedSection = () => {
		if (!unassignedBucket || unassignedBucket.total === 0) return null;

		const sortedTasks = getSortedTasks(unassignedBucket.tasks);
		const isExpanded = expandedBuckets["__unassigned"] ?? true;
		const displayTasks = showAllUnassigned ? sortedTasks : sortedTasks.slice(0, 12);
		const hasMore = sortedTasks.length > 12;

		return (
			<div className="mb-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 transition-colors duration-200">
				<div className="px-5 py-4">
					{/* Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2">
							<svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
								Unassigned tasks
							</h3>
							<span className="text-sm text-gray-500 dark:text-gray-400">
								({unassignedBucket.total})
							</span>
						</div>
						<button
							type="button"
							onClick={() => setExpandedBuckets((c) => ({ ...c, "__unassigned": !isExpanded }))}
							className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							{isExpanded ? "Collapse" : "Expand"}
							<svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>
					</div>

					{isExpanded && (
						<div className="mt-4">
							{/* Table */}
							<div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
								{/* Table header */}
								<div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									<div className="w-6" /> {/* Drag handle column */}
									<div className="w-24">ID</div>
									<div>Title</div>
									<div className="text-center w-24">Status</div>
									<div className="text-center w-20">Priority</div>
								</div>

								{/* Table rows */}
								<div className="divide-y divide-gray-200 dark:divide-gray-700">
									{displayTasks.map((task) => {
										const done = isDoneStatus(task.status);
										return (
											<div
												key={task.id}
												draggable
												onDragStart={(e) => handleDragStart(e, task)}
												onDragEnd={handleDragEnd}
												onClick={() => onEditTask(task)}
												className="group grid grid-cols-[auto_auto_1fr_auto_auto] gap-3 items-center px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
											>
												{/* Drag handle */}
												<div className="w-6 flex justify-center opacity-40 group-hover:opacity-100 transition-opacity">
													<DragHandle />
												</div>

												{/* Task ID */}
												<div className={`w-24 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap ${done ? "opacity-60" : ""}`}>
													{task.id}
												</div>

												{/* Task title */}
												<div className={`min-w-0 overflow-hidden ${done ? "opacity-60" : ""}`}>
													<span className={`text-sm truncate block whitespace-nowrap ${done ? "line-through text-gray-500" : "text-gray-900 dark:text-gray-100"}`}>
														{task.title}
													</span>
												</div>

												{/* Status badge */}
												<div className="w-24 flex justify-center">
													<span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(task.status)}`}>
														{task.status}
													</span>
												</div>

												{/* Priority badge */}
												<div className="w-20 flex justify-center">
													{task.priority ? (
														<span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${getPriorityBadgeClass(task.priority)}`}>
															{task.priority}
														</span>
													) : (
														<span className="text-xs text-gray-300 dark:text-gray-600">—</span>
													)}
												</div>
											</div>
										);
									})}
								</div>

								{/* Footer with show more/less */}
								{hasMore && (
									<div className="px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
										<button
											type="button"
											onClick={() => setShowAllUnassigned(!showAllUnassigned)}
											className="text-blue-600 dark:text-blue-400 hover:underline"
										>
											{showAllUnassigned
												? "Show less ↑"
												: `Show all ${sortedTasks.length} tasks ↓`}
										</button>
									</div>
								)}
							</div>

							{/* Hint */}
							<p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
								Drag tasks to a milestone below to assign them
							</p>
						</div>
					)}
				</div>
			</div>
		);
	};

	const noMilestones = allMilestones.length === 0;

	return (
		<div className="container mx-auto px-4 py-8 transition-colors duration-200">
			{/* Header */}
			<div className="flex items-center justify-between gap-4 mb-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Milestones</h1>
				<div className="flex items-center gap-3">
					{success && (
						<span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
							{success}
						</span>
					)}
					<button
						type="button"
						onClick={() => setShowAddModal(true)}
						className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-offset-gray-900 transition-colors"
					>
						+ Add milestone
					</button>
				</div>
			</div>

			{/* Unassigned tasks */}
			{renderUnassignedSection()}

			{/* Milestones */}
			{allMilestones.length > 0 && (
				<div className="space-y-4">
					{allMilestones.map((bucket) => renderMilestoneCard(bucket, bucket.total === 0))}
				</div>
			)}

			{/* Empty state */}
			{noMilestones && !unassignedBucket?.total && (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
					<p className="text-gray-500 dark:text-gray-400">No milestones yet. Create one to start organizing your tasks.</p>
				</div>
			)}

			{/* Add modal */}
			<Modal isOpen={showAddModal} onClose={closeAddModal} title="Add milestone" maxWidthClass="max-w-md">
				<form onSubmit={handleAddMilestone} className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">Milestone name</label>
						<input
							type="text"
							value={newMilestone}
							onChange={(e) => handleNewMilestoneChange(e.target.value)}
							placeholder="e.g. Release 1.0"
							autoFocus
							className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						{error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
					</div>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={closeAddModal}
							className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSaving || !newMilestone.trim()}
							className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
						>
							{isSaving ? "Saving..." : "Create"}
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
};

export default MilestonesPage;
