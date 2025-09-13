import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export interface TaskFilters {
	status?: string;
	priority?: string;
	search?: string;
	assignee?: string;
}

export interface UseTaskFiltersResult {
	filters: TaskFilters;
	setStatusFilter: (status?: string) => void;
	setPriorityFilter: (priority?: string) => void;
	setSearchFilter: (search?: string) => void;
	setAssigneeFilter: (assignee?: string) => void;
	clearAllFilters: () => void;
	hasActiveFilters: boolean;
}

/**
 * Custom hook to manage task filters with URL synchronization
 */
export const useTaskFilters = (): UseTaskFiltersResult => {
	const [searchParams, setSearchParams] = useSearchParams();

	// Initialize filters from URL params
	const [filters, setFilters] = useState<TaskFilters>(() => ({
		status: searchParams.get("status") || undefined,
		priority: searchParams.get("priority") || undefined,
		search: searchParams.get("search") || undefined,
		assignee: searchParams.get("assignee") || undefined,
	}));

	// Sync filters to URL whenever they change
	useEffect(() => {
		const newParams = new URLSearchParams();

		if (filters.status) newParams.set("status", filters.status);
		if (filters.priority) newParams.set("priority", filters.priority);
		if (filters.search) newParams.set("search", filters.search);
		if (filters.assignee) newParams.set("assignee", filters.assignee);

		setSearchParams(newParams);
	}, [filters, setSearchParams]);

	// Sync filters from URL when search params change (browser back/forward, direct links)
	useEffect(() => {
		const newFilters = {
			status: searchParams.get("status") || undefined,
			priority: searchParams.get("priority") || undefined,
			search: searchParams.get("search") || undefined,
			assignee: searchParams.get("assignee") || undefined,
		};

		// Only update if filters actually changed to prevent infinite loops
		if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
			setFilters(newFilters);
		}
	}, [searchParams]);

	// Update individual filter functions
	const setStatusFilter = useCallback((status?: string) => {
		setFilters((prev) => ({ ...prev, status: status || undefined }));
	}, []);

	const setPriorityFilter = useCallback((priority?: string) => {
		setFilters((prev) => ({ ...prev, priority: priority || undefined }));
	}, []);

	const setSearchFilter = useCallback((search?: string) => {
		setFilters((prev) => ({ ...prev, search: search || undefined }));
	}, []);

	const setAssigneeFilter = useCallback((assignee?: string) => {
		setFilters((prev) => ({ ...prev, assignee: assignee || undefined }));
	}, []);

	// Clear all filters
	const clearAllFilters = useCallback(() => {
		setFilters({});
	}, []);

	// Check if any filters are active
	const hasActiveFilters = !!(filters.status || filters.priority || filters.search || filters.assignee);

	return {
		filters,
		setStatusFilter,
		setPriorityFilter,
		setSearchFilter,
		setAssigneeFilter,
		clearAllFilters,
		hasActiveFilters,
	};
};
