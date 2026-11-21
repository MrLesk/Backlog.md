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

interface SearchContent {
	tasks: readonly Task[];
	documents: readonly Document[];
	decisions: readonly Decision[];
}

type SearchHit = Pick<FuseResult<SearchEntity>, "item" | "score" | "matches">;

export class SearchIndex {
	private readonly entities: SearchEntity[];
	private readonly fuse: Fuse<SearchEntity>;

	constructor({ tasks, documents, decisions }: SearchContent) {
		this.entities = [
			...tasks.map(
				(task): TaskSearchEntity => ({
					...buildTaskSearchFields(task),
					type: "task",
					task,
				}),
			),
			...documents.map(
				(document): DocumentSearchEntity => ({
					...EMPTY_TASK_SEARCH_FIELDS,
					id: document.id,
					type: "document",
					title: document.title,
					bodyText: document.rawContent ?? "",
					document,
				}),
			),
			...decisions.map(
				(decision): DecisionSearchEntity => ({
					...EMPTY_TASK_SEARCH_FIELDS,
					id: decision.id,
					type: "decision",
					title: decision.title,
					bodyText: decision.rawContent ?? "",
					decision,
				}),
			),
		];

		// Use the shared task-search weights and return match ranges for the browser.
		this.fuse = new Fuse(this.entities, { ...TASK_SEARCH_FUSE_OPTIONS, includeMatches: true });
	}

	search({ query = "", limit, types, filters }: SearchOptions = {}): SearchResult[] {
		const allowedTypes = new Set<SearchResultType>(
			types && types.length > 0 ? types : ["task", "document", "decision"],
		);
		const matchesTaskFilters = createTaskFilterMatcher(filters ?? {});
		const results: SearchResult[] = [];

		for (const hit of this.getHits(query.trim())) {
			const entity = hit.item;
			if (!allowedTypes.has(entity.type)) continue;
			if (entity.type === "task" && !matchesTaskFilters(entity.task)) continue;

			results.push(this.mapEntityToResult(entity, hit));
			if (limit && results.length >= limit) break;
		}

		return results;
	}

	private *getHits(query: string): Iterable<SearchHit> {
		if (query) {
			yield* this.fuse.search(query);
			return;
		}
		for (const item of this.entities) {
			yield { item };
		}
	}

	private mapEntityToResult(entity: SearchEntity, result: SearchHit): SearchResult {
		const score = result.score ?? null;
		const matches = this.mapMatches(result.matches);

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

export class SearchService {
	private index: SearchIndex | null = null;
	private initializing: Promise<void> | null = null;
	private unsubscribe?: () => void;
	private version = 0;

	constructor(private readonly store: ContentStore) {}

	async ensureInitialized(): Promise<void> {
		if (this.index) return;

		this.initializing ??= this.initialize().finally(() => {
			this.initializing = null;
		});
		await this.initializing;
	}

	dispose(): void {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.index = null;
		this.initializing = null;
	}

	search(options: SearchOptions = {}): SearchResult[] {
		if (!this.index) {
			throw new Error("SearchService not initialized. Call ensureInitialized() first.");
		}
		return this.index.search(options);
	}

	private async initialize(): Promise<void> {
		const snapshot = await this.store.ensureInitialized();
		this.unsubscribe ??= this.store.subscribe((event) => this.handleStoreEvent(event));
		this.index ??= new SearchIndex(snapshot);
	}

	private handleStoreEvent({ snapshot, version }: ContentStoreEvent): void {
		if (version <= this.version) return;
		this.version = version;
		this.index = new SearchIndex(snapshot);
	}
}
