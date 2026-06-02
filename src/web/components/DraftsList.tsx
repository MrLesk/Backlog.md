import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { apiClient } from '../lib/api';
import { type Milestone, type SearchPriorityFilter, type Task } from '../../types';
import LabelFilterDropdown from './LabelFilterDropdown';
import { collectAvailableLabels } from '../../utils/label-filter.ts';
import { getMilestoneLabel } from '../utils/milestones';

interface DraftsListProps {
	onEditTask: (task: Task) => void;
	onNewDraft: () => void;
	availableStatuses?: string[];
	availableMilestones?: string[];
	milestoneEntities?: Milestone[];
	availableLabels?: string[];
}

const DraftsList: React.FC<DraftsListProps> = ({
	onEditTask,
	onNewDraft,
	availableStatuses = [],
	availableMilestones = [],
	milestoneEntities = [],
	availableLabels = [],
}) => {
	const { t } = useI18n();
	const [searchParams, setSearchParams] = useSearchParams();
	const [drafts, setDrafts] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Filter state synced with URL
	const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
	const [priorityFilter, setPriorityFilter] = useState<"" | SearchPriorityFilter>(
		() => (searchParams.get("priority") as SearchPriorityFilter | null) ?? "",
	);
	const [milestoneFilter, setMilestoneFilter] = useState(() => searchParams.get("milestone") ?? "");
	const initialLabelParams = useMemo(() => {
		const labels = [...searchParams.getAll("label"), ...searchParams.getAll("labels")];
		const labelsCsv = searchParams.get("labels");
		if (labelsCsv) labels.push(...labelsCsv.split(","));
		return labels.map((label) => label.trim()).filter((label) => label.length > 0);
	}, []);
	const [labelFilter, setLabelFilter] = useState<string[]>(initialLabelParams);
	const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");

	useEffect(() => {
		loadDrafts();

		const handleDraftsUpdated = () => {
			loadDrafts();
		};

		window.addEventListener('drafts-updated', handleDraftsUpdated);
		return () => {
			window.removeEventListener('drafts-updated', handleDraftsUpdated);
		};
	}, []);

	// Sync URL params -> state on external navigation
	useEffect(() => {
		const paramStatus = searchParams.get("status") ?? "";
		const paramPriority = (searchParams.get("priority") as SearchPriorityFilter | null) ?? "";
		const paramMilestone = searchParams.get("milestone") ?? "";
		const paramLabels = [...searchParams.getAll("label"), ...searchParams.getAll("labels")];
		const labelsCsv = searchParams.get("labels");
		if (labelsCsv) paramLabels.push(...labelsCsv.split(","));
		const normalizedLabels = paramLabels.map((label) => label.trim()).filter((label) => label.length > 0);
		const paramSearch = searchParams.get("q") ?? "";

		if (paramStatus !== statusFilter) setStatusFilter(paramStatus);
		if (paramPriority !== priorityFilter) setPriorityFilter(paramPriority);
		if (paramMilestone !== milestoneFilter) setMilestoneFilter(paramMilestone);
		if (normalizedLabels.join("|") !== labelFilter.join("|")) setLabelFilter(normalizedLabels);
		if (paramSearch !== searchQuery) setSearchQuery(paramSearch);
	}, [searchParams]);

	const loadDrafts = async () => {
		try {
			setLoading(true);
			const response = await fetch('/api/drafts');
			if (!response.ok) {
				throw new Error(`Failed to load drafts: ${response.statusText}`);
			}
			const draftsData = await response.json();
			const sortedDrafts = [...draftsData].sort((a: Task, b: Task) => {
				const idA = parseInt(a.id.replace(/^\D+/, ''), 10);
				const idB = parseInt(b.id.replace(/^\D+/, ''), 10);
				return idB - idA;
			});
			setDrafts(sortedDrafts);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load drafts');
		} finally {
			setLoading(false);
		}
	};

	const handlePromoteDraft = async (draftId: string) => {
		if (!window.confirm(t.taskDetails.promoteConfirm)) return;
		try {
			const newTask = await apiClient.promoteDraft(draftId);
			await loadDrafts();
			window.dispatchEvent(new CustomEvent('drafts-updated'));
			onEditTask(newTask);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to promote draft');
		}
	};

	// Client-side filtering
	const filteredDrafts = useMemo(() => {
		let result = [...drafts];
		if (statusFilter) {
			result = result.filter((d) => d.status === statusFilter);
		}
		if (priorityFilter) {
			result = result.filter((d) => d.priority?.toLowerCase() === priorityFilter.toLowerCase());
		}
		if (milestoneFilter) {
			if (milestoneFilter === "__none") {
				result = result.filter((d) => !d.milestone);
			} else {
				result = result.filter((d) => d.milestone === milestoneFilter);
			}
		}
		if (labelFilter.length > 0) {
			result = result.filter((d) => labelFilter.every((label) => d.labels?.includes(label)));
		}
		const query = searchQuery.trim();
		if (query) {
			const normalizedQuery = query.toLowerCase();
			result = result.filter(
				(d) =>
					d.id.toLowerCase().includes(normalizedQuery) ||
					d.title.toLowerCase().includes(normalizedQuery),
			);
		}
		return result;
	}, [drafts, statusFilter, priorityFilter, milestoneFilter, labelFilter, searchQuery]);

	const hasActiveFilters = Boolean(
		statusFilter || priorityFilter || labelFilter.length > 0 || milestoneFilter || searchQuery.trim(),
	);

	const mergedAvailableLabels = useMemo(
		() => collectAvailableLabels(drafts, availableLabels),
		[drafts, availableLabels],
	);

	const milestoneOptions = useMemo(() => {
		const unique = Array.from(new Set([...availableMilestones.map((m) => m.trim()).filter(Boolean)]));
		return unique;
	}, [availableMilestones]);

	const syncUrl = (
		nextStatus: string,
		nextPriority: "" | SearchPriorityFilter,
		nextLabels: string[],
		nextMilestone: string,
		nextSearch: string,
	) => {
		const params = new URLSearchParams();
		if (nextStatus) params.set("status", nextStatus);
		if (nextPriority) params.set("priority", nextPriority);
		if (nextLabels.length > 0) {
			for (const label of nextLabels) params.append("label", label);
		}
		if (nextMilestone) params.set("milestone", nextMilestone);
		if (nextSearch.trim()) params.set("q", nextSearch.trim());
		setSearchParams(params, { replace: true });
	};

	const handleStatusChange = (value: string) => {
		setStatusFilter(value);
		syncUrl(value, priorityFilter, labelFilter, milestoneFilter, searchQuery);
	};

	const handlePriorityChange = (value: "" | SearchPriorityFilter) => {
		setPriorityFilter(value);
		syncUrl(statusFilter, value, labelFilter, milestoneFilter, searchQuery);
	};

	const handleMilestoneChange = (value: string) => {
		setMilestoneFilter(value);
		syncUrl(statusFilter, priorityFilter, labelFilter, value, searchQuery);
	};

	const handleLabelChange = (next: string[]) => {
		const normalized = next.map((label) => label.trim()).filter((label) => label.length > 0);
		setLabelFilter(normalized);
		syncUrl(statusFilter, priorityFilter, normalized, milestoneFilter, searchQuery);
	};

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		syncUrl(statusFilter, priorityFilter, labelFilter, milestoneFilter, value);
	};

	const handleClearFilters = () => {
		setStatusFilter("");
		setPriorityFilter("");
		setLabelFilter([]);
		setMilestoneFilter("");
		setSearchQuery("");
		syncUrl("", "", [], "", "");
	};

	const getPriorityColor = (priority?: string) => {
		switch (priority?.toLowerCase()) {
			case 'high':
				return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
			case 'medium':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
			case 'low':
				return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
		}
	};

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-gray-500 dark:text-gray-400">{t.drafts.loading}</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-red-600 dark:text-red-400">{t.common.error}: {error}</div>
				<button
					onClick={loadDrafts}
					className="ml-4 inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
				>
					{t.common.retry}
				</button>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8 transition-colors duration-200">
			<div className="flex flex-col gap-4 mb-6">
				<div className="flex items-center justify-between gap-3">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.drafts.title}</h1>
					<button
						className="inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
						onClick={onNewDraft}
					>
						{t.drafts.newDraft}
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-3 justify-between">
					<div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
						<div className="relative w-full min-w-[200px] max-w-[320px]">
							<span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
								<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</span>
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => handleSearchChange(e.target.value)}
								placeholder={t.drafts.searchPlaceholder}
								className="w-full pl-10 pr-10 py-2 h-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200"
							/>
							{searchQuery.trim() && (
								<button
									type="button"
									onClick={() => handleSearchChange("")}
									className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
								>
									<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							)}
						</div>

						<select
							value={statusFilter}
							onChange={(e) => handleStatusChange(e.target.value)}
							className="min-w-[140px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
						>
							<option value="">{t.taskList.allStatuses}</option>
							{availableStatuses.map((status) => (
								<option key={status} value={status}>{status}</option>
							))}
						</select>

						<select
							value={priorityFilter}
							onChange={(e) => handlePriorityChange(e.target.value as "" | SearchPriorityFilter)}
							className="min-w-[140px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
						>
							<option value="">{t.taskList.allPriorities}</option>
							<option value="high">{t.common.high}</option>
							<option value="medium">{t.common.medium}</option>
							<option value="low">{t.common.low}</option>
						</select>

						<select
							value={milestoneFilter}
							onChange={(e) => handleMilestoneChange(e.target.value)}
							className="min-w-[160px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
						>
							<option value="">{t.taskList.allMilestones}</option>
							<option value="__none">{t.taskList.noMilestone}</option>
							{milestoneOptions.map((milestone) => (
								<option key={milestone} value={milestone}>
									{getMilestoneLabel(milestone, milestoneEntities)}
								</option>
							))}
						</select>

						<LabelFilterDropdown
							availableLabels={mergedAvailableLabels}
							selectedLabels={labelFilter}
							onChange={handleLabelChange}
							menuId="drafts-labels-menu"
						/>
					</div>

					<div className="flex items-center gap-3 flex-shrink-0">
						<button
							type="button"
							onClick={handleClearFilters}
							className="py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 whitespace-nowrap"
							style={{ visibility: hasActiveFilters ? 'visible' : 'hidden' }}
						>
							{t.common.clear}
						</button>
						<div className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
							{t.drafts.showingCount(filteredDrafts.length, drafts.length)}
						</div>
					</div>
				</div>
			</div>

			{filteredDrafts.length === 0 ? (
				<div className="text-center py-12">
					<svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
					<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
						{hasActiveFilters ? t.drafts.noDraftsMatchFilters : t.drafts.noDrafts}
					</h3>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{hasActiveFilters ? t.drafts.tryAdjustingFilters : t.drafts.noDraftsDesc}
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{filteredDrafts.map((draft) => (
						<div
							key={draft.id}
							className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1 cursor-pointer" onClick={() => onEditTask(draft)}>
									<div className="flex items-center space-x-3 mb-2">
										<h3 className="text-lg font-medium text-gray-900 dark:text-white">{draft.title}</h3>
										{draft.priority && (
											<span className={`px-2 py-1 text-xs font-medium rounded-circle ${getPriorityColor(draft.priority)}`}>
												{draft.priority}
											</span>
										)}
									</div>
									<div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
										<span>{draft.id}</span>
										<span>{t.drafts.created}: {new Date(draft.createdDate).toLocaleDateString()}</span>
										{draft.updatedDate && (
											<span>{t.drafts.updated}: {new Date(draft.updatedDate).toLocaleDateString()}</span>
										)}
									</div>
									{draft.assignee && draft.assignee.length > 0 && (
										<div className="flex items-center space-x-2 mb-2">
											<span className="text-sm text-gray-500 dark:text-gray-400">{t.drafts.assignedTo}:</span>
											<div className="flex flex-wrap gap-1">
												{draft.assignee.map((person) => (
													<span key={person} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-circle">
														{person}
													</span>
												))}
											</div>
										</div>
									)}
									{draft.labels && draft.labels.length > 0 && (
										<div className="flex flex-wrap gap-1">
											{draft.labels.map((label) => (
												<span key={label} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-circle">
													{label}
												</span>
											))}
										</div>
									)}
								</div>
								<div className="ml-4">
									<button
										onClick={(e) => {
											e.stopPropagation();
											handlePromoteDraft(draft.id);
										}}
										className="inline-flex items-center px-3 py-1.5 bg-emerald-600 dark:bg-emerald-700 text-white text-sm font-medium rounded-md hover:bg-emerald-700 dark:hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 dark:focus:ring-offset-gray-800 transition-colors duration-200"
									>
										{t.drafts.promoteToTask}
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default DraftsList;
