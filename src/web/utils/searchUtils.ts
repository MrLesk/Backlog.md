// Search utility functions

export interface ParsedQuery {
	filters: Record<string, string>;
	textQuery: string;
}

export interface SearchItem {
	id: string;
	title: string;
	type: "doc" | "decision" | "task";
	body?: string;
	searchableTitle: string;
	searchableContent: string;
	searchableLabels?: string;
	[key: string]: unknown; // For additional fields like status, priority, assignee, etc.
}

/**
 * Parse search query to separate command filters and text query
 */
export const parseSearchQuery = (query: string): ParsedQuery => {
	const parts = query.split(" ");
	const filters: Record<string, string> = {};
	let textQuery = "";

	parts.forEach((part) => {
		if (part.includes(":")) {
			const [field, value] = part.split(":", 2);
			if (field && value) {
				filters[field] = value;
			}
		} else {
			textQuery += `${part} `;
		}
	});

	return { filters, textQuery: textQuery.trim() };
};

/**
 * Get nested value from object using dot notation
 */
export const getNestedValue = (obj: unknown, path: string): unknown => {
	return path.split(".").reduce((current, key) => {
		if (Array.isArray(current)) {
			return current.find((item) => item && typeof item === "object" && key in item);
		}
		return current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
	}, obj);
};

/**
 * Apply command-based filters
 */
export const applyCommandFilters = (items: SearchItem[], filters: Record<string, string>): SearchItem[] => {
	if (Object.keys(filters).length === 0) {
		return items;
	}

	return items.filter((item) => {
		return Object.entries(filters).every(([field, value]) => {
			const fieldValue = getNestedValue(item, field);
			if (!fieldValue) return false;

			// Handle arrays (e.g., labels, assignee)
			if (Array.isArray(fieldValue)) {
				return fieldValue.some((v) => v.toString().toLowerCase().includes(value.toLowerCase()));
			}

			// Handle strings/numbers - exact match for commands
			return fieldValue.toString().toLowerCase() === value.toLowerCase();
		});
	});
};

/**
 * Perform command-based search
 */
export const performCommandSearch = (query: string, items: SearchItem[]) => {
	const { filters, textQuery } = parseSearchQuery(query);

	// Apply command filters first
	let filteredData = applyCommandFilters(items, filters);

	// If there's text query, use simple text matching
	if (textQuery) {
		filteredData = filteredData.filter(
			(item) =>
				item.searchableTitle.toLowerCase().includes(textQuery.toLowerCase()) ||
				item.searchableContent.toLowerCase().includes(textQuery.toLowerCase()) ||
				item.id.toLowerCase().includes(textQuery.toLowerCase()) ||
				item.searchableLabels?.toLowerCase().includes(textQuery.toLowerCase()),
		);
	}

	return filteredData;
};
