import type { Server, ServerWebSocket } from "bun";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { ContentStore } from "../core/content-store.ts";
import type { SearchService } from "../core/search-service.ts";
import { getTaskStatistics } from "../core/statistics.ts";
import type { SearchPriorityFilter, SearchResultType, Task } from "../types/index.ts";
import { getVersion } from "../utils/version.ts";

const TASK_ID_PREFIX = "task-";

function parseTaskIdSegments(value: string): number[] | null {
	const withoutPrefix = value.startsWith(TASK_ID_PREFIX) ? value.slice(TASK_ID_PREFIX.length) : value;
	if (!/^[0-9]+(?:\.[0-9]+)*$/.test(withoutPrefix)) {
		return null;
	}
	return withoutPrefix.split(".").map((segment) => Number.parseInt(segment, 10));
}

function findTaskByLooseId(tasks: Task[], inputId: string): Task | undefined {
	const normalized = inputId.startsWith(TASK_ID_PREFIX) ? inputId : `${TASK_ID_PREFIX}${inputId}`;
	const exact = tasks.find((task) => task.id === normalized);
	if (exact) {
		return exact;
	}

	const inputSegments = parseTaskIdSegments(inputId);
	if (!inputSegments) {
		return undefined;
	}

	return tasks.find((task) => {
		const candidateSegments = parseTaskIdSegments(task.id);
		if (!candidateSegments || candidateSegments.length !== inputSegments.length) {
			return false;
		}
		for (let index = 0; index < candidateSegments.length; index += 1) {
			if (candidateSegments[index] !== inputSegments[index]) {
				return false;
			}
		}
		return true;
	});
}

// @ts-expect-error
import favicon from "../web/favicon.png" with { type: "file" };
import indexHtml from "../web/index.html";

export class BacklogServer {
	private core: Core;
	private server: Server | null = null;
	private projectName = "Untitled Project";
	private sockets = new Set<ServerWebSocket<unknown>>();
	private contentStore: ContentStore | null = null;
	private searchService: SearchService | null = null;
	private unsubscribeContentStore?: () => void;
	private storeReadyBroadcasted = false;

	constructor(projectPath: string) {
		this.core = new Core(projectPath);
	}

	private async ensureServicesReady(): Promise<void> {
		const store = await this.core.getContentStore();
		this.contentStore = store;
		if (!this.unsubscribeContentStore) {
			this.unsubscribeContentStore = store.subscribe((event) => {
				if (event.type === "ready") {
					if (!this.storeReadyBroadcasted) {
						this.storeReadyBroadcasted = true;
						return;
					}
					this.broadcastTasksUpdated();
					return;
				}

				// Broadcast for tasks/documents/decisions so clients refresh caches/search
				this.storeReadyBroadcasted = true;
				this.broadcastTasksUpdated();
			});
		}

		const search = await this.core.getSearchService();
		this.searchService = search;
	}

	private async getContentStoreInstance(): Promise<ContentStore> {
		await this.ensureServicesReady();
		if (!this.contentStore) {
			throw new Error("Content store not initialized");
		}
		return this.contentStore;
	}

	private async getSearchServiceInstance(): Promise<SearchService> {
		await this.ensureServicesReady();
		if (!this.searchService) {
			throw new Error("Search service not initialized");
		}
		return this.searchService;
	}

	getPort(): number | null {
		return this.server?.port ?? null;
	}

	private broadcastTasksUpdated() {
		for (const ws of this.sockets) {
			try {
				ws.send("tasks-updated");
			} catch {}
		}
	}

	async start(port?: number, openBrowser = true): Promise<void> {
		// Prevent duplicate starts (e.g., accidental re-entry)
		if (this.server) {
			console.log("Server already running");
			return;
		}
		// Load config (migration is handled globally by CLI)
		const config = await this.core.filesystem.loadConfig();

		// Use config default port if no port specified
		const finalPort = port ?? config?.defaultPort ?? 6420;
		this.projectName = config?.projectName || "Untitled Project";

		// Check if browser should open (config setting or CLI override)
		// Default to true if autoOpenBrowser is not explicitly set to false
		const shouldOpenBrowser = openBrowser && (config?.autoOpenBrowser ?? true);

		try {
			await this.ensureServicesReady();
			const serveOptions = {
				port: finalPort,
				development: process.env.NODE_ENV === "development",
				routes: {
					"/": indexHtml,
					"/tasks": indexHtml,
					"/drafts": indexHtml,
					"/documentation": indexHtml,
					"/documentation/*": indexHtml,
					"/decisions": indexHtml,
					"/decisions/*": indexHtml,
					"/statistics": indexHtml,
					"/settings": indexHtml,

					// API Routes using Bun's native route syntax
					"/api/tasks": {
						GET: async (req: Request) => await this.handleListTasks(req),
						POST: async (req: Request) => await this.handleCreateTask(req),
					},
					"/api/task/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetTask(req.params.id),
					},
					"/api/tasks/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetTask(req.params.id),
						PUT: async (req: Request & { params: { id: string } }) => await this.handleUpdateTask(req, req.params.id),
						DELETE: async (req: Request & { params: { id: string } }) => await this.handleDeleteTask(req.params.id),
					},
					"/api/tasks/:id/complete": {
						POST: async (req: Request & { params: { id: string } }) => await this.handleCompleteTask(req.params.id),
					},
					"/api/statuses": {
						GET: async () => await this.handleGetStatuses(),
					},
					"/api/config": {
						GET: async () => await this.handleGetConfig(),
						PUT: async (req: Request) => await this.handleUpdateConfig(req),
					},
					"/api/docs": {
						GET: async () => await this.handleListDocs(),
						POST: async (req: Request) => await this.handleCreateDoc(req),
					},
					"/api/doc/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDoc(req.params.id),
					},
					"/api/docs/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDoc(req.params.id),
						PUT: async (req: Request & { params: { id: string } }) => await this.handleUpdateDoc(req, req.params.id),
					},
					"/api/decisions": {
						GET: async () => await this.handleListDecisions(),
						POST: async (req: Request) => await this.handleCreateDecision(req),
					},
					"/api/decision/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDecision(req.params.id),
					},
					"/api/decisions/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDecision(req.params.id),
						PUT: async (req: Request & { params: { id: string } }) =>
							await this.handleUpdateDecision(req, req.params.id),
					},
					"/api/drafts": {
						GET: async () => await this.handleListDrafts(),
					},
					"/api/drafts/:id/promote": {
						POST: async (req: Request & { params: { id: string } }) => await this.handlePromoteDraft(req.params.id),
					},
					"/api/tasks/reorder": {
						POST: async (req: Request) => await this.handleReorderTask(req),
					},
					"/api/version": {
						GET: async () => await this.handleGetVersion(),
					},
					"/api/statistics": {
						GET: async () => await this.handleGetStatistics(),
					},
					"/api/search": {
						GET: async (req: Request) => await this.handleSearch(req),
					},
					"/sequences": {
						GET: async () => await this.handleGetSequences(),
					},
					"/sequences/move": {
						POST: async (req: Request) => await this.handleMoveSequence(req),
					},
					"/api/sequences": {
						GET: async () => await this.handleGetSequences(),
					},
					"/api/sequences/move": {
						POST: async (req: Request) => await this.handleMoveSequence(req),
					},
				},
				fetch: async (req: Request, server: Server) => {
					return await this.handleRequest(req, server);
				},
				error: this.handleError.bind(this),
				websocket: {
					open: (ws: ServerWebSocket) => {
						this.sockets.add(ws);
					},
					message(ws: ServerWebSocket) {
						ws.send("pong");
					},
					close: (ws: ServerWebSocket) => {
						this.sockets.delete(ws);
					},
				},
				/* biome-ignore format: keep cast on single line below for type narrowing */
			};
			this.server = Bun.serve(serveOptions as unknown as Parameters<typeof Bun.serve>[0]);

			const url = `http://localhost:${finalPort}`;
			console.log(`🚀 Backlog.md browser interface running at ${url}`);
			console.log(`📊 Project: ${this.projectName}`);
			const stopKey = process.platform === "darwin" ? "Cmd+C" : "Ctrl+C";
			console.log(`⏹️  Press ${stopKey} to stop the server`);

			if (shouldOpenBrowser) {
				console.log("🌐 Opening browser...");
				await this.openBrowser(url);
			} else {
				console.log("💡 Open your browser and navigate to the URL above");
			}
		} catch (error) {
			// Handle port already in use error
			const errorCode = (error as { code?: string })?.code;
			const errorMessage = (error as Error)?.message;
			if (errorCode === "EADDRINUSE" || errorMessage?.includes("address already in use")) {
				console.error(`\n❌ Error: Port ${finalPort} is already in use.\n`);
				console.log("💡 Suggestions:");
				console.log(`   1. Try a different port: backlog browser --port ${finalPort + 1}`);
				console.log(`   2. Find what's using port ${finalPort}:`);
				if (process.platform === "darwin" || process.platform === "linux") {
					console.log(`      Run: lsof -i :${finalPort}`);
				} else if (process.platform === "win32") {
					console.log(`      Run: netstat -ano | findstr :${finalPort}`);
				}
				console.log("   3. Or kill the process using the port and try again\n");
				process.exit(1);
			}

			// Handle other errors
			console.error("❌ Failed to start server:", errorMessage || error);
			process.exit(1);
		}
	}

	private _stopping = false;

	async stop(): Promise<void> {
		if (this._stopping) return;
		this._stopping = true;

		// Stop filesystem watcher first to reduce churn
		try {
			this.unsubscribeContentStore?.();
			this.unsubscribeContentStore = undefined;
		} catch {}

		this.core.disposeSearchService();
		this.core.disposeContentStore();
		this.searchService = null;
		this.contentStore = null;
		this.storeReadyBroadcasted = false;

		// Proactively close WebSocket connections
		for (const ws of this.sockets) {
			try {
				ws.close();
			} catch {}
		}
		this.sockets.clear();

		// Attempt to stop the server but don't hang forever
		if (this.server) {
			const serverRef = this.server;
			const stopPromise = (async () => {
				try {
					await serverRef.stop();
				} catch {}
			})();
			const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
			await Promise.race([stopPromise, timeout]);
			this.server = null;
			console.log("Server stopped");
		}

		this._stopping = false;
	}

	private async openBrowser(url: string): Promise<void> {
		try {
			const platform = process.platform;
			let cmd: string[];

			switch (platform) {
				case "darwin": // macOS
					cmd = ["open", url];
					break;
				case "win32": // Windows
					cmd = ["cmd", "/c", "start", "", url];
					break;
				default: // Linux and others
					cmd = ["xdg-open", url];
					break;
			}

			await $`${cmd}`.quiet();
		} catch (error) {
			console.warn("⚠️  Failed to open browser automatically:", error);
			console.log("💡 Please open your browser manually and navigate to the URL above");
		}
	}

	private async handleRequest(req: Request, server: Server): Promise<Response> {
		const url = new URL(req.url);
		const pathname = url.pathname;

		// Handle WebSocket upgrade
		if (req.headers.get("upgrade") === "websocket") {
			const success = server.upgrade(req);
			if (success) {
				return new Response(null, { status: 101 }); // WebSocket upgrade response
			}
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		// Workaround as Bun doesn't support images imported from link tags in HTML
		if (pathname.startsWith("/favicon")) {
			const faviconFile = Bun.file(favicon);
			return new Response(faviconFile, {
				headers: { "Content-Type": "image/png" },
			});
		}

		// For all other routes, return 404 since routes should handle all valid paths
		return new Response("Not Found", { status: 404 });
	}

	// Task handlers
	private async handleListTasks(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const status = url.searchParams.get("status") || undefined;
		const assignee = url.searchParams.get("assignee") || undefined;
		const parent = url.searchParams.get("parent") || undefined;
		const priorityParam = url.searchParams.get("priority") || undefined;

		let priority: SearchPriorityFilter | undefined;
		if (priorityParam) {
			const normalizedPriority = priorityParam.toLowerCase();
			const allowed: SearchPriorityFilter[] = ["high", "medium", "low"];
			if (!allowed.includes(normalizedPriority as SearchPriorityFilter)) {
				return Response.json({ error: "Invalid priority filter" }, { status: 400 });
			}
			priority = normalizedPriority as SearchPriorityFilter;
		}

		const store = await this.getContentStoreInstance();
		const baseTasks = store.getTasks();
		const filter: { status?: string; assignee?: string; priority?: SearchPriorityFilter; parentTaskId?: string } = {};
		if (status) filter.status = status;
		if (assignee) filter.assignee = assignee;
		if (priority) filter.priority = priority;

		if (parent) {
			let parentTask = findTaskByLooseId(baseTasks, parent);
			if (!parentTask) {
				const fallbackId = parent.startsWith(TASK_ID_PREFIX) ? parent : `${TASK_ID_PREFIX}${parent}`;
				const fallback = await this.core.filesystem.loadTask(fallbackId);
				if (fallback) {
					store.upsertTask(fallback);
					parentTask = fallback;
				}
			}
			if (!parentTask) {
				const normalizedParent = parent.startsWith(TASK_ID_PREFIX) ? parent : `${TASK_ID_PREFIX}${parent}`;
				return Response.json({ error: `Parent task ${normalizedParent} not found` }, { status: 404 });
			}
			filter.parentTaskId = parentTask.id;
		}

		const tasks = store.getTasks(filter);
		return Response.json(tasks);
	}

	private async handleSearch(req: Request): Promise<Response> {
		try {
			const searchService = await this.getSearchServiceInstance();
			const url = new URL(req.url);
			const query = url.searchParams.get("query") ?? undefined;
			const limitParam = url.searchParams.get("limit");
			const typeParams = [...url.searchParams.getAll("type"), ...url.searchParams.getAll("types")];
			const statusParams = url.searchParams.getAll("status");
			const priorityParamsRaw = url.searchParams.getAll("priority");

			let limit: number | undefined;
			if (limitParam) {
				const parsed = Number.parseInt(limitParam, 10);
				if (Number.isNaN(parsed) || parsed <= 0) {
					return Response.json({ error: "limit must be a positive integer" }, { status: 400 });
				}
				limit = parsed;
			}

			let types: SearchResultType[] | undefined;
			if (typeParams.length > 0) {
				const allowed: SearchResultType[] = ["task", "document", "decision"];
				const normalizedTypes = typeParams
					.map((value) => value.toLowerCase())
					.filter((value): value is SearchResultType => {
						return allowed.includes(value as SearchResultType);
					});
				if (normalizedTypes.length === 0) {
					return Response.json({ error: "type must be task, document, or decision" }, { status: 400 });
				}
				types = normalizedTypes;
			}

			const filters: {
				status?: string | string[];
				priority?: SearchPriorityFilter | SearchPriorityFilter[];
			} = {};

			if (statusParams.length === 1) {
				filters.status = statusParams[0];
			} else if (statusParams.length > 1) {
				filters.status = statusParams;
			}

			if (priorityParamsRaw.length > 0) {
				const allowedPriorities: SearchPriorityFilter[] = ["high", "medium", "low"];
				const normalizedPriorities = priorityParamsRaw.map((value) => value.toLowerCase());
				const invalidPriority = normalizedPriorities.find(
					(value) => !allowedPriorities.includes(value as SearchPriorityFilter),
				);
				if (invalidPriority) {
					return Response.json(
						{ error: `Unsupported priority '${invalidPriority}'. Use high, medium, or low.` },
						{ status: 400 },
					);
				}
				const casted = normalizedPriorities as SearchPriorityFilter[];
				filters.priority = casted.length === 1 ? casted[0] : casted;
			}

			const results = searchService.search({ query, limit, types, filters });
			return Response.json(results);
		} catch (error) {
			console.error("Error performing search:", error);
			return Response.json({ error: "Search failed" }, { status: 500 });
		}
	}

	private async handleCreateTask(req: Request): Promise<Response> {
		const taskData = await req.json();
		const task = await this.core.createTaskFromData(taskData);
		return Response.json(task, { status: 201 });
	}

	private async handleGetTask(taskId: string): Promise<Response> {
		const store = await this.getContentStoreInstance();
		const tasks = store.getTasks();
		const task = findTaskByLooseId(tasks, taskId);
		if (!task) {
			const fallbackId = taskId.startsWith(TASK_ID_PREFIX) ? taskId : `${TASK_ID_PREFIX}${taskId}`;
			const fallback = await this.core.filesystem.loadTask(fallbackId);
			if (fallback) {
				store.upsertTask(fallback);
				return Response.json(fallback);
			}
			return Response.json({ error: "Task not found" }, { status: 404 });
		}
		return Response.json(task);
	}

	private async handleUpdateTask(req: Request, taskId: string): Promise<Response> {
		const updates = await req.json();
		const existingTask = await this.core.filesystem.loadTask(taskId);
		if (!existingTask) {
			return Response.json({ error: "Task not found" }, { status: 404 });
		}

		const updatedTask: Task = {
			...existingTask,
			...updates,
		};

		await this.core.updateTask(updatedTask);
		return Response.json(updatedTask);
	}

	private async handleDeleteTask(taskId: string): Promise<Response> {
		const success = await this.core.archiveTask(taskId);
		if (!success) {
			return Response.json({ error: "Task not found" }, { status: 404 });
		}
		return Response.json({ success: true });
	}

	private async handleCompleteTask(taskId: string): Promise<Response> {
		try {
			const task = await this.core.filesystem.loadTask(taskId);
			if (!task) {
				return Response.json({ error: "Task not found" }, { status: 404 });
			}

			const success = await this.core.completeTask(taskId);
			if (!success) {
				return Response.json({ error: "Failed to complete task" }, { status: 500 });
			}

			// Notify listeners to refresh
			this.broadcastTasksUpdated();
			return Response.json({ success: true });
		} catch (error) {
			console.error("Error completing task:", error);
			return Response.json({ error: "Failed to complete task" }, { status: 500 });
		}
	}

	private async handleGetStatuses(): Promise<Response> {
		const config = await this.core.filesystem.loadConfig();
		const statuses = config?.statuses || ["To Do", "In Progress", "Done"];
		return Response.json(statuses);
	}

	// Documentation handlers
	private async handleListDocs(): Promise<Response> {
		try {
			const store = await this.getContentStoreInstance();
			const docs = store.getDocuments();
			const docFiles = docs.map((doc) => ({
				name: `${doc.title}.md`,
				id: doc.id,
				title: doc.title,
				type: doc.type,
				createdDate: doc.createdDate,
				updatedDate: doc.updatedDate,
				lastModified: doc.updatedDate || doc.createdDate,
				tags: doc.tags || [],
			}));
			return Response.json(docFiles);
		} catch (error) {
			console.error("Error listing documents:", error);
			return Response.json([]);
		}
	}

	private async handleGetDoc(docId: string): Promise<Response> {
		try {
			const store = await this.getContentStoreInstance();
			const documents = store.getDocuments();
			const doc = documents.find((d) => d.id === docId || d.title === docId);

			if (!doc) {
				return Response.json({ error: "Document not found" }, { status: 404 });
			}

			return Response.json(doc);
		} catch (error) {
			console.error("Error loading document:", error);
			return Response.json({ error: "Document not found" }, { status: 404 });
		}
	}

	private async handleCreateDoc(req: Request): Promise<Response> {
		const { filename, content } = await req.json();

		try {
			const title = filename.replace(".md", "");
			const document = await this.core.createDocumentWithId(title, content);
			return Response.json({ success: true, id: document.id }, { status: 201 });
		} catch (error) {
			console.error("Error creating document:", error);
			return Response.json({ error: "Failed to create document" }, { status: 500 });
		}
	}

	private async handleUpdateDoc(req: Request, docId: string): Promise<Response> {
		const content = await req.text();

		try {
			const store = await this.getContentStoreInstance();
			const documents = store.getDocuments();
			const existingDoc = documents.find((d) => d.id === docId || d.title === docId);

			if (!existingDoc) {
				return Response.json({ error: "Document not found" }, { status: 404 });
			}

			await this.core.updateDocument(existingDoc, content);
			return Response.json({ success: true });
		} catch (error) {
			console.error("Error updating document:", error);
			return Response.json({ error: "Failed to update document" }, { status: 500 });
		}
	}

	// Decision handlers
	private async handleListDecisions(): Promise<Response> {
		try {
			const store = await this.getContentStoreInstance();
			const decisions = store.getDecisions();
			const decisionFiles = decisions.map((decision) => ({
				id: decision.id,
				title: decision.title,
				status: decision.status,
				date: decision.date,
				context: decision.context,
				decision: decision.decision,
				consequences: decision.consequences,
				alternatives: decision.alternatives,
			}));
			return Response.json(decisionFiles);
		} catch (error) {
			console.error("Error listing decisions:", error);
			return Response.json([]);
		}
	}

	private async handleGetDecision(decisionId: string): Promise<Response> {
		try {
			const store = await this.getContentStoreInstance();
			const normalizedId = decisionId.startsWith("decision-") ? decisionId : `decision-${decisionId}`;
			const decision = store.getDecisions().find((item) => item.id === normalizedId || item.id === decisionId);

			if (!decision) {
				return Response.json({ error: "Decision not found" }, { status: 404 });
			}

			return Response.json(decision);
		} catch (error) {
			console.error("Error loading decision:", error);
			return Response.json({ error: "Decision not found" }, { status: 404 });
		}
	}

	private async handleCreateDecision(req: Request): Promise<Response> {
		const { title } = await req.json();

		try {
			const decision = await this.core.createDecisionWithTitle(title);
			return Response.json(decision, { status: 201 });
		} catch (error) {
			console.error("Error creating decision:", error);
			return Response.json({ error: "Failed to create decision" }, { status: 500 });
		}
	}

	private async handleUpdateDecision(req: Request, decisionId: string): Promise<Response> {
		const content = await req.text();

		try {
			await this.core.updateDecisionFromContent(decisionId, content);
			return Response.json({ success: true });
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return Response.json({ error: "Decision not found" }, { status: 404 });
			}
			console.error("Error updating decision:", error);
			return Response.json({ error: "Failed to update decision" }, { status: 500 });
		}
	}

	private async handleGetConfig(): Promise<Response> {
		try {
			const config = await this.core.filesystem.loadConfig();
			if (!config) {
				return Response.json({ error: "Configuration not found" }, { status: 404 });
			}
			return Response.json(config);
		} catch (error) {
			console.error("Error loading config:", error);
			return Response.json({ error: "Failed to load configuration" }, { status: 500 });
		}
	}

	private async handleUpdateConfig(req: Request): Promise<Response> {
		try {
			const updatedConfig = await req.json();

			// Validate configuration
			if (!updatedConfig.projectName?.trim()) {
				return Response.json({ error: "Project name is required" }, { status: 400 });
			}

			if (updatedConfig.defaultPort && (updatedConfig.defaultPort < 1 || updatedConfig.defaultPort > 65535)) {
				return Response.json({ error: "Port must be between 1 and 65535" }, { status: 400 });
			}

			// Save configuration
			await this.core.filesystem.saveConfig(updatedConfig);

			// Update local project name if changed
			if (updatedConfig.projectName !== this.projectName) {
				this.projectName = updatedConfig.projectName;
			}

			return Response.json(updatedConfig);
		} catch (error) {
			console.error("Error updating config:", error);
			return Response.json({ error: "Failed to update configuration" }, { status: 500 });
		}
	}

	private handleError(error: Error): Response {
		console.error("Server Error:", error);
		return new Response("Internal Server Error", { status: 500 });
	}

	// Draft handlers
	private async handleListDrafts(): Promise<Response> {
		try {
			const drafts = await this.core.filesystem.listDrafts();
			return Response.json(drafts);
		} catch (error) {
			console.error("Error listing drafts:", error);
			return Response.json([]);
		}
	}

	private async handlePromoteDraft(draftId: string): Promise<Response> {
		try {
			const success = await this.core.promoteDraft(draftId);
			if (!success) {
				return Response.json({ error: "Draft not found" }, { status: 404 });
			}
			return Response.json({ success: true });
		} catch (error) {
			console.error("Error promoting draft:", error);
			return Response.json({ error: "Failed to promote draft" }, { status: 500 });
		}
	}

	private async handleGetVersion(): Promise<Response> {
		try {
			const version = await getVersion();
			return Response.json({ version });
		} catch (error) {
			console.error("Error getting version:", error);
			return Response.json({ error: "Failed to get version" }, { status: 500 });
		}
	}

	private async handleReorderTask(req: Request): Promise<Response> {
		try {
			const { taskId, newOrdinal, columnTasks } = await req.json();

			if (!taskId || newOrdinal === undefined) {
				return Response.json({ error: "Missing required fields: taskId and newOrdinal" }, { status: 400 });
			}

			// Load the task to update
			const task = await this.core.filesystem.loadTask(taskId);
			if (!task) {
				return Response.json({ error: "Task not found" }, { status: 404 });
			}

			// Update the task's ordinal value
			const updatedTask: Task = {
				...task,
				ordinal: newOrdinal,
				// Note: updatedDate will be set automatically by Core.updateTask
			};

			// Save the updated task
			await this.core.updateTask(updatedTask);

			// If other tasks in the column need ordinal updates (to prevent collisions)
			if (columnTasks && Array.isArray(columnTasks)) {
				// Reassign ordinals to prevent conflicts
				const tasksToUpdate: Task[] = [];
				let ordinal = 1000;

				for (const columnTask of columnTasks) {
					if (columnTask.id !== taskId) {
						const existingTask = await this.core.filesystem.loadTask(columnTask.id);
						if (existingTask && existingTask.ordinal !== ordinal) {
							tasksToUpdate.push({
								...existingTask,
								ordinal: ordinal,
								// Note: updatedDate will be set automatically by Core.updateTask
							});
						}
						ordinal += 1000;
					}
				}

				// Use Core's bulk update method instead of manual git operations
				if (tasksToUpdate.length > 0) {
					await this.core.updateTasksBulk(tasksToUpdate, "Reorder tasks in column");
				}
			}

			return Response.json({ success: true, task: updatedTask });
		} catch (error) {
			console.error("Error reordering task:", error);
			return Response.json({ error: "Failed to reorder task" }, { status: 500 });
		}
	}

	// Sequences handlers
	private async handleGetSequences(): Promise<Response> {
		const data = await this.core.listActiveSequences();
		return Response.json(data);
	}

	private async handleMoveSequence(req: Request): Promise<Response> {
		try {
			const body = await req.json();
			const taskId = String(body.taskId || "").trim();
			const moveToUnsequenced = Boolean(body.unsequenced === true);
			const targetSequenceIndex = body.targetSequenceIndex !== undefined ? Number(body.targetSequenceIndex) : undefined;

			if (!taskId) return Response.json({ error: "taskId is required" }, { status: 400 });

			const next = await this.core.moveTaskInSequences({
				taskId,
				unsequenced: moveToUnsequenced,
				targetSequenceIndex,
			});
			return Response.json(next);
		} catch (error) {
			const message = (error as Error)?.message || "Invalid request";
			return Response.json({ error: message }, { status: 400 });
		}
	}

	private async handleGetStatistics(): Promise<Response> {
		try {
			// Load tasks using the same logic as CLI overview
			const { tasks, drafts, statuses } = await this.core.loadAllTasksForStatistics();

			// Calculate statistics using the exact same function as CLI
			const statistics = getTaskStatistics(tasks, drafts, statuses);

			// Convert Maps to objects for JSON serialization
			const response = {
				...statistics,
				statusCounts: Object.fromEntries(statistics.statusCounts),
				priorityCounts: Object.fromEntries(statistics.priorityCounts),
			};

			return Response.json(response);
		} catch (error) {
			console.error("Error getting statistics:", error);
			return Response.json({ error: "Failed to get statistics" }, { status: 500 });
		}
	}
}
