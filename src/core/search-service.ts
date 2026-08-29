import Fuse, { type FuseResult, type FuseResultMatch } from "fuse.js";
import type {
	Decision,
	Document,
	SearchMatch,
	SearchOptions,
	SearchResult,
	SearchResultType,
	Task,
} from "../types/index.ts";
import {
	buildTaskSearchFields,
	createTaskFilterMatcher,
	TASK_SEARCH_FUSE_OPTIONS,
	type TaskSearchFields,
} from "../utils/task-search.ts";
import type { ContentStore, ContentStoreEvent } from "./content-store.ts";

/**
 * Documents and decisions are indexed with the same Fuse keys as tasks, so they expose the task
 * search fields with empty values for the task-only ones.
 */
const EMPTY_TASK_SEARCH_FIELDS: Omit<TaskSearchFields, "title" | "bodyText" | "id"> = {
	idVariants: [],
	dependencyIds: [],
	modifiedFiles: [],
};

interface BaseSearchEntity extends TaskSearchFields {
	readonly type: SearchResultType;
}

interface TaskSearchEntity extends BaseSearchEntity {
	readonly type: "task";
	readonly task: Task;
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
		const matchesTaskFilters = createTaskFilterMatcher(filters ?? {});

		if (trimmedQuery === "") {
			return this.collectWithoutQuery(allowedTypes, matchesTaskFilters, limit);
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

			if (entity.type === "task" && !matchesTaskFilters(entity.task)) {
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
			...buildTaskSearchFields(task),
			type: "task",
			task,
		}));

		this.documents = documents.map((document) => ({
			...EMPTY_TASK_SEARCH_FIELDS,
			id: document.id,
			type: "document",
			title: document.title,
			bodyText: document.rawContent ?? "",
			document,
		}));

		this.decisions = decisions.map((decision) => ({
			...EMPTY_TASK_SEARCH_FIELDS,
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

		// Same keys, weights, and threshold as every other task search; only the highlight ranges
		// this surface reports back to callers are extra.
		this.fuse = new Fuse(this.collection, { ...TASK_SEARCH_FUSE_OPTIONS, includeMatches: true });
	}

	private collectWithoutQuery(
		allowedTypes: Set<SearchResultType>,
		matchesTaskFilters: (task: Task) => boolean,
		limit?: number,
	): SearchResult[] {
		const results: SearchResult[] = [];

		if (allowedTypes.has("task")) {
			const tasks = this.tasks.filter((entity) => matchesTaskFilters(entity.task));
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
