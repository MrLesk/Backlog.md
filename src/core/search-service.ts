import Fuse, { type FuseResult, type FuseResultMatch } from "fuse.js";
import type {
	Decision,
	Document,
	SearchFilters,
	SearchMatch,
	SearchOptions,
	SearchPriorityFilter,
	SearchResult,
	SearchResultType,
	Task,
} from "../types/index.ts";
import type { ContentStore, ContentStoreEvent } from "./content-store.ts";

interface BaseSearchEntity {
	readonly id: string;
	readonly type: SearchResultType;
	readonly title: string;
	readonly bodyText: string;
}

interface TaskSearchEntity extends BaseSearchEntity {
	readonly type: "task";
	readonly task: Task;
	readonly statusLower: string;
	readonly priorityLower?: SearchPriorityFilter;
	readonly labelsLower: string[];
	readonly idVariants: string[];
	readonly dependencyIds: string[];
}

interface DocumentSearchEntity extends BaseSearchEntity {
	readonly type: "document";
	readonly document: Document;
}

interface DecisionSearchEntity extends BaseSearchEntity {
	readonly type: "decision";
	readonly decision: Decision;
}

type SearchEntity = TaskSearchEntity | DocumentSearchEntity | DecisionSearchEntity;

type NormalizedFilters = {
	statuses?: string[];
	priorities?: SearchPriorityFilter[];
	labels?: string[];
};

const TASK_ID_PREFIX = "task-";

function parseTaskIdSegments(value: string): number[] | null {
	const lowerValue = value.toLowerCase();
	const withoutPrefix = lowerValue.startsWith(TASK_ID_PREFIX) ? lowerValue.slice(TASK_ID_PREFIX.length) : lowerValue;
	if (!/^[0-9]+(?:\.[0-9]+)*$/.test(withoutPrefix)) {
		return null;
	}
	return withoutPrefix.split(".").map((segment) => Number.parseInt(segment, 10));
}

function createTaskIdVariants(id: string): string[] {
	const lowerId = id.toLowerCase();
	const segments = parseTaskIdSegments(id);
	if (!segments) {
		const normalized = lowerId.startsWith(TASK_ID_PREFIX) ? lowerId : `${TASK_ID_PREFIX}${lowerId}`;
		return id === normalized ? [normalized] : [normalized, id, lowerId];
	}
	const canonicalSuffix = segments.join(".");
	const variants = new Set<string>();
	const normalized = lowerId.startsWith(TASK_ID_PREFIX) ? lowerId : `${TASK_ID_PREFIX}${lowerId}`;
	variants.add(normalized);
	variants.add(`${TASK_ID_PREFIX}${canonicalSuffix}`);
	variants.add(canonicalSuffix);
	// Also add individual numeric segments for short-query matching (e.g., "7" matching "TASK-0007")
	for (const segment of segments) {
		variants.add(String(segment));
	}
	if (id !== normalized) {
		variants.add(id);
		variants.add(lowerId);
	}
	return Array.from(variants);
}

export class SearchService {
	private initialized = false;
	private initializing: Promise<void> | null = null;
	private unsubscribe?: () => void;
	private fuse: Fuse<SearchEntity> | null = null;
	private tasks: TaskSearchEntity[] = [];
	private documents: DocumentSearchEntity[] = [];
	private decisions: DecisionSearchEntity[] = [];
	private collection: SearchEntity[] = [];
	private version = 0;

	constructor(private readonly store: ContentStore) {}

	async ensureInitialized(): Promise<void> {
		if (this.initialized) {
			return;
		}

		if (!this.initializing) {
			this.initializing = this.initialize().catch((error) => {
				this.initializing = null;
				throw error;
			});
		}

		await this.initializing;
	}

	dispose(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}
		this.fuse = null;
		this.collection = [];
		this.tasks = [];
		this.documents = [];
		this.decisions = [];
		this.initialized = false;
		this.initializing = null;
	}

	search(options: SearchOptions = {}): SearchResult[] {
		if (!this.initialized) {
			throw new Error("SearchService not initialized. Call ensureInitialized() first.");
		}

		const { query = "", limit, types, filters } = options;

		const trimmedQuery = query.trim();
		const allowedTypes = new Set<SearchResultType>(
			types && types.length > 0 ? types : ["task", "document", "decision"],
		);
		const normalizedFilters = this.normalizeFilters(filters);

		if (trimmedQuery === "") {
			return this.collectWithoutQuery(allowedTypes, normalizedFilters, limit);
		}

		const fuse = this.fuse;
		if (!fuse) {
			return [];
		}

		const fuseResults = fuse.search(trimmedQuery);
		const results: SearchResult[] = [];

		for (const result of fuseResults) {
			const entity = result.item;
			if (!allowedTypes.has(entity.type)) {
				continue;
			}

			if (entity.type === "task" && !this.matchesTaskFilters(entity, normalizedFilters)) {
				continue;
			}

			results.push(this.mapEntityToResult(entity, result));
			if (limit && results.length >= limit) {
				break;
			}
		}

		return results;
	}

	private async initialize(): Promise<void> {
		const snapshot = await this.store.ensureInitialized();
		this.applySnapshot(snapshot.tasks, snapshot.documents, snapshot.decisions);

		if (!this.unsubscribe) {
			this.unsubscribe = this.store.subscribe((event) => {
				this.handleStoreEvent(event);
			});
		}

		this.initialized = true;
		this.initializing = null;
	}

	private handleStoreEvent(event: ContentStoreEvent): void {
		if (event.version <= this.version) {
			return;
		}
		this.version = event.version;
		this.applySnapshot(event.snapshot.tasks, event.snapshot.documents, event.snapshot.decisions);
	}

	private applySnapshot(tasks: Task[], documents: Document[], decisions: Decision[]): void {
		this.tasks = tasks.map((task) => ({
			id: task.id,
			type: "task",
			title: task.title,
			bodyText: buildTaskBodyText(task),
			task,
			statusLower: task.status.toLowerCase(),
			priorityLower: task.priority ? (task.priority.toLowerCase() as SearchPriorityFilter) : undefined,
			labelsLower: (task.labels || []).map((label) => label.toLowerCase()),
			idVariants: createTaskIdVariants(task.id),
			dependencyIds: (task.dependencies ?? []).flatMap((dependency) => createTaskIdVariants(dependency)),
		}));

		this.documents = documents.map((document) => ({
			id: document.id,
			type: "document",
			title: document.title,
			bodyText: document.rawContent ?? "",
			document,
		}));

		this.decisions = decisions.map((decision) => ({
			id: decision.id,
			type: "decision",
			title: decision.title,
			bodyText: decision.rawContent ?? "",
			decision,
		}));

		this.collection = [...this.tasks, ...this.documents, ...this.decisions];
		this.rebuildFuse();
	}

	private rebuildFuse(): void {
		if (this.collection.length === 0) {
			this.fuse = null;
			return;
		}

		this.fuse = new Fuse(this.collection, {
			includeScore: true,
			includeMatches: true,
			threshold: 0.35,
			ignoreLocation: true,
			minMatchCharLength: 2,
			keys: [
				{ name: "title", weight: 0.35 },
				{ name: "bodyText", weight: 0.3 },
				{ name: "id", weight: 0.2 },
				{ name: "idVariants", weight: 0.1 },
				{ name: "dependencyIds", weight: 0.05 },
			],
		});
	}

	private collectWithoutQuery(
		allowedTypes: Set<SearchResultType>,
		filters: NormalizedFilters,
		limit?: number,
	): SearchResult[] {
		const results: SearchResult[] = [];

		if (allowedTypes.has("task")) {
			const tasks = this.applyTaskFilters(this.tasks, filters);
			for (const entity of tasks) {
				results.push(this.mapEntityToResult(entity));
				if (limit && results.length >= limit) {
					return results;
				}
			}
		}

		if (allowedTypes.has("document")) {
			for (const entity of this.documents) {
				results.push(this.mapEntityToResult(entity));
				if (limit && results.length >= limit) {
					return results;
				}
			}
		}

		if (allowedTypes.has("decision")) {
			for (const entity of this.decisions) {
				results.push(this.mapEntityToResult(entity));
				if (limit && results.length >= limit) {
					return results;
				}
			}
		}

		return results;
	}

	private applyTaskFilters(tasks: TaskSearchEntity[], filters: NormalizedFilters): TaskSearchEntity[] {
		let filtered = tasks;
		if (filters.statuses && filters.statuses.length > 0) {
			const allowedStatuses = new Set(filters.statuses);
			filtered = filtered.filter((task) => allowedStatuses.has(task.statusLower));
		}
		if (filters.priorities && filters.priorities.length > 0) {
			const allowedPriorities = new Set(filters.priorities);
			filtered = filtered.filter((task) => {
				if (!task.priorityLower) {
					return false;
				}
				return allowedPriorities.has(task.priorityLower);
			});
		}
		if (filters.labels && filters.labels.length > 0) {
			const requiredLabels = new Set(filters.labels);
			filtered = filtered.filter((task) => {
				if (!task.labelsLower || task.labelsLower.length === 0) {
					return false;
				}
				return task.labelsLower.some((label) => requiredLabels.has(label));
			});
		}
		return filtered;
	}

	private matchesTaskFilters(task: TaskSearchEntity, filters: NormalizedFilters): boolean {
		if (filters.statuses && filters.statuses.length > 0) {
			if (!filters.statuses.includes(task.statusLower)) {
				return false;
			}
		}

		if (filters.priorities && filters.priorities.length > 0) {
			if (!task.priorityLower || !filters.priorities.includes(task.priorityLower)) {
				return false;
			}
		}

		if (filters.labels && filters.labels.length > 0) {
			if (!task.labelsLower || task.labelsLower.length === 0) {
				return false;
			}
			const labelSet = new Set(task.labelsLower);
			const anyMatch = filters.labels.some((label) => labelSet.has(label));
			if (!anyMatch) {
				return false;
			}
		}

		return true;
	}

	private normalizeFilters(filters?: SearchFilters): NormalizedFilters {
		if (!filters) {
			return {};
		}

		const statuses = this.normalizeStringArray(filters.status);
		const priorities = this.normalizePriorityArray(filters.priority);
		const labels = this.normalizeLabelsArray(filters.labels);

		return {
			statuses,
			priorities,
			labels,
		};
	}

	private normalizeStringArray(value?: string | string[]): string[] | undefined {
		if (!value) {
			return undefined;
		}

		const values = Array.isArray(value) ? value : [value];
		const normalized = values.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0);

		return normalized.length > 0 ? normalized : undefined;
	}

	private normalizeLabelsArray(value?: string | string[]): string[] | undefined {
		if (!value) {
			return undefined;
		}

		const values = Array.isArray(value) ? value : [value];
		const normalized = values.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0);

		return normalized.length > 0 ? normalized : undefined;
	}

	private normalizePriorityArray(
		value?: SearchPriorityFilter | SearchPriorityFilter[],
	): SearchPriorityFilter[] | undefined {
		if (!value) {
			return undefined;
		}

		const values = Array.isArray(value) ? value : [value];
		const normalized = values
			.map((item) => item.trim().toLowerCase())
			.filter((item): item is SearchPriorityFilter => {
				return item === "high" || item === "medium" || item === "low";
			});

		return normalized.length > 0 ? normalized : undefined;
	}

	private mapEntityToResult(entity: SearchEntity, result?: FuseResult<SearchEntity>): SearchResult {
		const score = result?.score ?? null;
		const matches = this.mapMatches(result?.matches);

		if (entity.type === "task") {
			return {
				type: "task",
				score,
				task: entity.task,
				matches,
			};
		}

		if (entity.type === "document") {
			return {
				type: "document",
				score,
				document: entity.document,
				matches,
			};
		}

		return {
			type: "decision",
			score,
			decision: entity.decision,
			matches,
		};
	}

	private mapMatches(matches?: readonly FuseResultMatch[]): SearchMatch[] | undefined {
		if (!matches || matches.length === 0) {
			return undefined;
		}

		return matches.map((match) => ({
			key: match.key,
			indices: match.indices.map(([start, end]) => [start, end] as [number, number]),
			value: match.value,
		}));
	}
}
function buildTaskBodyText(task: Task): string {
	const parts: string[] = [];

	if (task.description) {
		parts.push(task.description);
	}

	if (Array.isArray(task.acceptanceCriteriaItems) && task.acceptanceCriteriaItems.length > 0) {
		const lines = [...task.acceptanceCriteriaItems]
			.sort((a, b) => a.index - b.index)
			.map((criterion) => `- [${criterion.checked ? "x" : " "}] ${criterion.text}`);
		parts.push(lines.join("\n"));
	}

	if (task.implementationPlan) {
		parts.push(task.implementationPlan);
	}

	if (task.implementationNotes) {
		parts.push(task.implementationNotes);
	}

	return parts.join("\n\n");
}
