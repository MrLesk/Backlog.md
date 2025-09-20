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
	readonly rawContent: string;
}

interface TaskSearchEntity extends BaseSearchEntity {
	readonly type: "task";
	readonly task: Task;
	readonly statusLower: string;
	readonly priorityLower?: SearchPriorityFilter;
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
};

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
			rawContent: task.rawContent ?? "",
			task,
			statusLower: task.status.toLowerCase(),
			priorityLower: task.priority ? (task.priority.toLowerCase() as SearchPriorityFilter) : undefined,
		}));

		this.documents = documents.map((document) => ({
			id: document.id,
			type: "document",
			title: document.title,
			rawContent: document.rawContent ?? "",
			document,
		}));

		this.decisions = decisions.map((decision) => ({
			id: decision.id,
			type: "decision",
			title: decision.title,
			rawContent: decision.rawContent ?? "",
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
				{ name: "title", weight: 0.45 },
				{ name: "rawContent", weight: 0.35 },
				{ name: "id", weight: 0.2 },
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

		return true;
	}

	private normalizeFilters(filters?: SearchFilters): NormalizedFilters {
		if (!filters) {
			return {};
		}

		const statuses = this.normalizeStringArray(filters.status);
		const priorities = this.normalizePriorityArray(filters.priority);

		return {
			statuses,
			priorities,
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
