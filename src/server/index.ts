import net from "node:net";
import { dirname, join } from "node:path";
import type { Server, ServerWebSocket } from "bun";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { ContentStore } from "../core/content-store.ts";
import { initializeProject } from "../core/init.ts";
import type { SearchService } from "../core/search-service.ts";
import { getTaskStatistics } from "../core/statistics.ts";
import { isCreateLockError } from "../file-system/operations.ts";
import { BacklogToolError } from "../mcp/errors/mcp-errors.ts";
import { MilestoneHandlers } from "../mcp/tools/milestones/handlers.ts";
import {
	DOCUMENT_TYPE_VALUES,
	type Document,
	type SearchPriorityFilter,
	type SearchResultType,
	type TaskUpdateInput,
} from "../types/index.ts";
import { detectDuplicateTaskIds } from "../utils/duplicate-detection.ts";
import { resolveMilestoneInputForStorage } from "../utils/milestone-storage.ts";
import { formatValidPriorityValues, resolvePriorityValue } from "../utils/priority-config.ts";
import { formatValidStatuses, getCanonicalStatuses, getValidStatuses } from "../utils/status.ts";
import { resolveTaskById } from "../utils/task-id.ts";
import { getVersion } from "../utils/version.ts";

// Regex pattern to match any prefix (letters followed by dash)
const PREFIX_PATTERN = /^[a-zA-Z]+-/i;
const DEFAULT_PREFIX = "task-";
const DOCUMENT_TYPES = new Set<Document["type"]>(DOCUMENT_TYPE_VALUES);

class DocumentPayloadValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DocumentPayloadValidationError";
	}
}

function parseDocumentType(value: unknown): Document["type"] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string") {
		throw new DocumentPayloadValidationError("Document type must be a string.");
	}
	if (!DOCUMENT_TYPES.has(value as Document["type"])) {
		throw new DocumentPayloadValidationError(`Document type must be one of: ${DOCUMENT_TYPE_VALUES.join(", ")}.`);
	}
	return value as Document["type"];
}

function parseDocumentTags(value: unknown): string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!Array.isArray(value)) {
		throw new DocumentPayloadValidationError("Document tags must be an array of strings.");
	}
	if (value.some((tag) => typeof tag !== "string")) {
		throw new DocumentPayloadValidationError("Document tags must be an array of strings.");
	}
	return Array.from(new Set(value.map((tag) => tag.trim()).filter((tag) => tag.length > 0)));
}

function parseCreateDocumentPath(value: unknown): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string") {
		throw new DocumentPayloadValidationError("Document path must be a string.");
	}
	return value;
}

function parseUpdateDocumentPath(value: unknown): string | null | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (value === null || typeof value === "string") {
		return value;
	}
	throw new DocumentPayloadValidationError("Document path must be a string or null.");
}

function collectDelimitedSearchParams(url: URL, names: string[]): string[] {
	const values = names.flatMap((name) => url.searchParams.getAll(name));
	return values
		.flatMap((value) => value.split(","))
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

function isDocumentValidationError(error: Error): boolean {
	return (
		error instanceof DocumentPayloadValidationError ||
		error.message.startsWith("Document type ") ||
		error.message.startsWith("Document path ") ||
		error.message === "Title is required to create a document." ||
		error.message === "Document title cannot be empty."
	);
}

/**
 * Ensure an ID has a prefix. If it already has one, return as-is.
 * Otherwise, add the default "task-" prefix.
 */
function ensurePrefix(id: string): string {
	if (PREFIX_PATTERN.test(id)) {
		return id;
	}
	return `${DEFAULT_PREFIX}${id}`;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true") return true;
		if (normalized === "false") return false;
	}
	return undefined;
}

import indexHtml from "../web/index.html";

const NO_STORE_HEADERS = {
	"Cache-Control": "no-store, max-age=0, must-revalidate",
	Pragma: "no-cache",
	Expires: "0",
} as const;

function applyNoStoreHeaders(headers: Headers): void {
	for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
		headers.set(name, value);
	}
}

export function markHtmlBundleNoStore(bundle: Bun.HTMLBundle): Bun.HTMLBundle {
	if (!bundle.files) {
		return bundle;
	}

	for (const file of bundle.files) {
		if (file.loader === "html" && file.isEntry) {
			Object.assign(file.headers, NO_STORE_HEADERS);
		}
	}

	return bundle;
}

const spaIndexHtml = markHtmlBundleNoStore(indexHtml);
const MIN_PORT = 1;
const MAX_PORT = 65535;

export async function isPortAvailable(port: number): Promise<boolean> {
	if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) return false;
	return new Promise((resolve) => {
		const srv = net.createServer();
		srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

export async function findNextAvailablePort(startPort: number, maxPort = MAX_PORT): Promise<number | null> {
	if (!Number.isInteger(startPort) || !Number.isInteger(maxPort)) return null;

	const firstPort = Math.max(startPort, MIN_PORT);
	const lastPort = Math.min(maxPort, MAX_PORT);
	for (let port = firstPort; port <= lastPort; port++) {
		if (await isPortAvailable(port)) {
			return port;
		}
	}
	return null;
}

export class BacklogServer {
	private core: Core;
	private server: Server<unknown> | null = null;
	private projectName = "Untitled Project";
	private sockets = new Set<ServerWebSocket<unknown>>();
	private contentStore: ContentStore | null = null;
	private searchService: SearchService | null = null;
	private unsubscribeContentStore?: () => void;
	private storeReadyBroadcasted = false;

	constructor(projectPath: string) {
		this.core = new Core(projectPath, { enableWatchers: true });
	}

	private async resolveMilestoneInput(milestone: string): Promise<string> {
		const [activeMilestones, archivedMilestones] = await Promise.all([
			this.core.filesystem.listMilestones(),
			this.core.filesystem.listArchivedMilestones(),
		]);
		return resolveMilestoneInputForStorage(milestone, activeMilestones, archivedMilestones);
	}

	private async ensureServicesReady(): Promise<void> {
		const store = await this.core.getContentStore();
		this.contentStore = store;

		if (!this.unsubscribeContentStore) {
			this.unsubscribeContentStore = store.subscribe((event) => {
				if (event.type === "config") {
					this.storeReadyBroadcasted = true;
					this.projectName = event.config.projectName;
					this.broadcastConfigUpdated();
					return;
				}

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

	private broadcastConfigUpdated() {
		for (const ws of this.sockets) {
			try {
				ws.send("config-updated");
			} catch {}
		}
	}

	async start(port?: number, openBrowser = true): Promise<void> {
		// Prevent duplicate starts (e.g., accidental re-entry)
		if (this.server) {
			console.log("Server already running");
			return;
		}
		this._stopping = false;
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
					"/": spaIndexHtml,
					"/tasks": spaIndexHtml,
					"/tasks/*": spaIndexHtml,
					"/board": spaIndexHtml,
					"/board/*": spaIndexHtml,
					"/milestones": spaIndexHtml,
					"/drafts": spaIndexHtml,
					"/documentation": spaIndexHtml,
					"/documentation/*": spaIndexHtml,
					"/decisions": spaIndexHtml,
					"/decisions/*": spaIndexHtml,
					"/statistics": spaIndexHtml,
					"/settings": spaIndexHtml,

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
					"/api/milestones": {
						GET: async () => await this.handleListMilestones(),
						POST: async (req: Request) => await this.handleCreateMilestone(req),
					},
					"/api/milestones/archived": {
						GET: async () => await this.handleListArchivedMilestones(),
					},
					"/api/milestones/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetMilestone(req.params.id),
						PUT: async (req: Request & { params: { id: string } }) =>
							await this.handleUpdateMilestone(req, req.params.id),
						DELETE: async (req: Request & { params: { id: string } }) =>
							await this.handleRemoveMilestone(req, req.params.id),
					},
					"/api/milestones/:id/archive": {
						POST: async (req: Request & { params: { id: string } }) => await this.handleArchiveMilestone(req.params.id),
					},
					"/api/tasks/reorder": {
						POST: async (req: Request) => await this.handleReorderTask(req),
					},
					"/api/tasks/cleanup": {
						GET: async (req: Request) => await this.handleCleanupPreview(req),
					},
					"/api/tasks/duplicates": {
						GET: async () => await this.handleGetDuplicateTasks(),
					},
					"/api/tasks/cleanup/execute": {
						POST: async (req: Request) => await this.handleCleanupExecute(req),
					},
					"/api/version": {
						GET: async () => await this.handleGetVersion(),
					},
					"/api/statistics": {
						GET: async () => await this.handleGetStatistics(),
					},
					"/api/status": {
						GET: async () => await this.handleGetStatus(),
					},
					"/api/init": {
						POST: async (req: Request) => await this.handleInit(req),
					},
					"/api/search": {
						GET: async (req: Request) => await this.handleSearch(req),
					},
					// Serve files placed under backlog/assets at /assets/<relative-path>
					"/assets/*": {
						GET: async (req: Request) => await this.handleAssetRequest(req),
					},
				},
				fetch: async (req: Request, server: Server<unknown>) => {
					const res = await this.handleRequest(req, server);

					// Disable caching for GET/HEAD so browser always fetches latest content
					if (req.method === "GET" || req.method === "HEAD") {
						applyNoStoreHeaders(res.headers);
					}

					return res;
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
				console.error(`\n❌ Error: Port ${finalPort} is already in use. Use --port to specify a different port.\n`);
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

	private async handleAssetRequest(req: Request): Promise<Response> {
		try {
			const url = new URL(req.url);
			const pathname = decodeURIComponent(url.pathname || "");
			const prefix = "/assets/";
			if (!pathname.startsWith(prefix)) return new Response("Not Found", { status: 404 });

			// Path relative to backlog/assets
			const relPath = pathname.slice(prefix.length);

			// disallow traversal
			if (relPath.includes("..")) return new Response("Not Found", { status: 404 });

			// derive backlog root from docsDir (parent of backlog/docs)
			const docsDir = this.core.filesystem.docsDir;
			const backlogRoot = dirname(docsDir);
			const assetsRoot = join(backlogRoot, "assets");
			const filePath = join(assetsRoot, relPath);

			if (!filePath.startsWith(assetsRoot)) return new Response("Not Found", { status: 404 });

			const file = Bun.file(filePath);
			if (!(await file.exists())) return new Response("Not Found", { status: 404 });

			const ext = (filePath.match(/\.([^./]+)$/) || [])[1]?.toLowerCase() || "";
			const mimeMap: Record<string, string> = {
				png: "image/png",
				jpg: "image/jpeg",
				jpeg: "image/jpeg",
				gif: "image/gif",
				svg: "image/svg+xml",
				webp: "image/webp",
				avif: "image/avif",
				pdf: "application/pdf",
				txt: "text/plain",
				css: "text/css",
				js: "application/javascript",
			};

			const mime = mimeMap[ext] ?? "application/octet-stream";
			return new Response(file, { headers: { "Content-Type": mime } });
		} catch (error) {
			console.error("Error serving asset:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	}

	private async handleRequest(req: Request, server: Server<unknown>): Promise<Response> {
		// Handle WebSocket upgrade
		if (req.headers.get("upgrade") === "websocket") {
			const success = server.upgrade(req, { data: undefined });
			if (success) {
				return new Response(null, { status: 101 }); // WebSocket upgrade response
			}
			return new Response("WebSocket upgrade failed", { status: 400 });
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
		const crossBranch = url.searchParams.get("crossBranch") === "true";
		const excludeStatusParams = collectDelimitedSearchParams(url, [
			"excludeStatus",
			"exclude-status",
			"excludeStatuses",
			"exclude-statuses",
		]);
		const labelParams = [...url.searchParams.getAll("label"), ...url.searchParams.getAll("labels")];
		const labelsCsv = url.searchParams.get("labels");
		if (labelsCsv) {
			labelParams.push(...labelsCsv.split(","));
		}
		const labels = labelParams.map((label) => label.trim()).filter((label) => label.length > 0);

		const config = await this.core.filesystem.loadConfig();
		let priority: string | undefined;
		if (priorityParam) {
			const normalizedPriority = resolvePriorityValue(priorityParam, config);
			if (!normalizedPriority) {
				return Response.json(
					{ error: `Invalid priority filter. Valid values are: ${formatValidPriorityValues(config)}` },
					{ status: 400 },
				);
			}
			priority = normalizedPriority;
		}

		let excludeStatus: string[] | undefined;
		if (excludeStatusParams.length > 0) {
			const { values, invalid, validStatuses } = await getCanonicalStatuses(excludeStatusParams, this.core);
			if (invalid.length > 0) {
				return Response.json(
					{
						error: `Invalid excludeStatus filter: ${invalid.join(", ")}. Valid statuses are: ${formatValidStatuses(validStatuses)}`,
					},
					{ status: 400 },
				);
			}
			excludeStatus = values.length > 0 ? values : undefined;
		}

		// Resolve parent task ID if provided
		let parentTaskId: string | undefined;
		if (parent) {
			const store = await this.getContentStoreInstance();
			const allTasks = store.getTasks();
			const parentResolution = resolveTaskById(allTasks, parent);
			if (parentResolution.status === "ambiguous") {
				return Response.json({ error: `Parent task ${parent} is ambiguous` }, { status: 409 });
			}
			let parentTask = parentResolution.status === "found" ? parentResolution.task : undefined;
			if (!parentTask) {
				const fallbackId = ensurePrefix(parent);
				const fallback = await this.core.filesystem.loadTask(fallbackId);
				if (fallback) {
					store.upsertTask(fallback);
					parentTask = fallback;
				}
			}
			if (!parentTask) {
				const normalizedParent = ensurePrefix(parent);
				return Response.json({ error: `Parent task ${normalizedParent} not found` }, { status: 404 });
			}
			parentTaskId = parentTask.id;
		}

		// Use Core.queryTasks which handles all filtering and cross-branch logic
		const tasks = await this.core.queryTasks({
			filters: {
				status,
				excludeStatus,
				assignee,
				priority,
				parentTaskId,
				labels: labels.length > 0 ? labels : undefined,
			},
			includeCrossBranch: crossBranch,
		});

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
			const excludeStatusParams = collectDelimitedSearchParams(url, [
				"excludeStatus",
				"exclude-status",
				"excludeStatuses",
				"exclude-statuses",
			]);
			const priorityParamsRaw = url.searchParams.getAll("priority");
			const assigneeParamsRaw = [...url.searchParams.getAll("assignee"), ...url.searchParams.getAll("assignees")];
			const labelParamsRaw = [...url.searchParams.getAll("label"), ...url.searchParams.getAll("labels")];
			const modifiedFileParamsRaw = [
				...url.searchParams.getAll("modifiedFile"),
				...url.searchParams.getAll("modifiedFiles"),
			];
			const assigneesCsv = url.searchParams.get("assignees");
			if (assigneesCsv) {
				assigneeParamsRaw.push(...assigneesCsv.split(","));
			}
			const labelsCsv = url.searchParams.get("labels");
			if (labelsCsv) {
				labelParamsRaw.push(...labelsCsv.split(","));
			}
			const modifiedFilesCsv = url.searchParams.get("modifiedFiles");
			if (modifiedFilesCsv) {
				modifiedFileParamsRaw.push(...modifiedFilesCsv.split(","));
			}

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
				excludeStatus?: string | string[];
				priority?: SearchPriorityFilter | SearchPriorityFilter[];
				assignee?: string | string[];
				labels?: string | string[];
				modifiedFiles?: string | string[];
			} = {};

			if (statusParams.length === 1) {
				filters.status = statusParams[0];
			} else if (statusParams.length > 1) {
				filters.status = statusParams;
			}

			if (excludeStatusParams.length > 0) {
				const { values, invalid, validStatuses } = await getCanonicalStatuses(excludeStatusParams, this.core);
				if (invalid.length > 0) {
					return Response.json(
						{
							error: `Invalid excludeStatus filter: ${invalid.join(", ")}. Valid statuses are: ${formatValidStatuses(validStatuses)}`,
						},
						{ status: 400 },
					);
				}
				filters.excludeStatus = values.length === 1 ? values[0] : values;
			}

			if (priorityParamsRaw.length > 0) {
				const config = await this.core.filesystem.loadConfig();
				const normalizedPriorities = priorityParamsRaw.map((value) => resolvePriorityValue(value, config));
				const invalidPriority = priorityParamsRaw[normalizedPriorities.findIndex((value) => !value)];
				if (invalidPriority) {
					return Response.json(
						{
							error: `Unsupported priority '${invalidPriority}'. Use ${formatValidPriorityValues(config)}.`,
						},
						{ status: 400 },
					);
				}
				const casted = normalizedPriorities.filter((value): value is SearchPriorityFilter => Boolean(value));
				filters.priority = casted.length === 1 ? casted[0] : casted;
			}

			if (assigneeParamsRaw.length > 0) {
				const normalizedAssignees = assigneeParamsRaw.map((value) => value.trim()).filter((value) => value.length > 0);
				if (normalizedAssignees.length > 0) {
					filters.assignee = normalizedAssignees.length === 1 ? normalizedAssignees[0] : normalizedAssignees;
				}
			}

			if (labelParamsRaw.length > 0) {
				const normalizedLabels = labelParamsRaw.map((value) => value.trim()).filter((value) => value.length > 0);
				if (normalizedLabels.length > 0) {
					filters.labels = normalizedLabels.length === 1 ? normalizedLabels[0] : normalizedLabels;
				}
			}

			if (modifiedFileParamsRaw.length > 0) {
				const normalizedModifiedFiles = modifiedFileParamsRaw
					.map((value) => value.trim())
					.filter((value) => value.length > 0);
				if (normalizedModifiedFiles.length > 0) {
					filters.modifiedFiles =
						normalizedModifiedFiles.length === 1 ? normalizedModifiedFiles[0] : normalizedModifiedFiles;
				}
			}

			const results = searchService.search({ query, limit, types, filters });
			return Response.json(results);
		} catch (error) {
			console.error("Error performing search:", error);
			return Response.json({ error: "Search failed" }, { status: 500 });
		}
	}

	private async handleCreateTask(req: Request): Promise<Response> {
		const payload = await req.json();

		if (!payload || typeof payload.title !== "string" || payload.title.trim().length === 0) {
			return Response.json({ error: "Title is required" }, { status: 400 });
		}

		const acceptanceCriteria = Array.isArray(payload.acceptanceCriteriaItems)
			? payload.acceptanceCriteriaItems
					.map((item: { text?: string; checked?: boolean }) => ({
						text: String(item?.text ?? "").trim(),
						checked: Boolean(item?.checked),
					}))
					.filter((item: { text: string }) => item.text.length > 0)
			: [];
		const definitionOfDoneAdd = Array.isArray(payload.definitionOfDoneAdd)
			? payload.definitionOfDoneAdd
					.map((item: unknown) => String(item ?? "").trim())
					.filter((item: string) => item.length > 0)
			: [];
		const disableDefinitionOfDoneDefaults = Boolean(payload.disableDefinitionOfDoneDefaults);

		try {
			const milestone =
				typeof payload.milestone === "string" ? await this.resolveMilestoneInput(payload.milestone) : undefined;

			const { task: createdTask } = await this.core.createTaskFromInput({
				title: payload.title,
				description: payload.description,
				status: payload.status,
				priority: payload.priority,
				type: typeof payload.type === "string" ? payload.type : undefined,
				milestone,
				labels: payload.labels,
				assignee: payload.assignee,
				dependencies: payload.dependencies,
				references: payload.references,
				modifiedFiles: payload.modifiedFiles,
				parentTaskId: payload.parentTaskId,
				implementationPlan: payload.implementationPlan,
				implementationNotes: payload.implementationNotes,
				finalSummary: payload.finalSummary,
				acceptanceCriteria,
				definitionOfDoneAdd,
				disableDefinitionOfDoneDefaults,
			});
			return Response.json(createdTask, { status: 201 });
		} catch (error) {
			if (isCreateLockError(error)) {
				const message = error instanceof Error ? error.message : "Failed to create task";
				return Response.json({ error: message }, { status: 409 });
			}
			const message = error instanceof Error ? error.message : "Failed to create task";
			return Response.json({ error: message }, { status: 400 });
		}
	}

	private async handleGetTask(taskId: string): Promise<Response> {
		const localTasks = await this.core.filesystem.listTasks();
		const localResolution = resolveTaskById(localTasks, taskId);
		if (localResolution.status === "invalid") {
			return Response.json({ error: `Invalid task ID: ${taskId}` }, { status: 400 });
		}

		const store = await this.getContentStoreInstance();
		await this.core.refreshTasksForTaskRead();
		const config = await this.core.filesystem.loadConfig();
		const checkActiveBranches = config?.checkActiveBranches !== false;
		const storedResolution = resolveTaskById(store.getTasks(), taskId);
		const activeBranchCollision = await this.core.hasActiveBranchTaskIdCollision(taskId, localTasks);
		if (
			localResolution.status === "ambiguous" ||
			(checkActiveBranches && storedResolution.status === "ambiguous") ||
			activeBranchCollision
		) {
			return Response.json(
				{ error: `Task ID ${taskId} is ambiguous. Repair duplicate task IDs before opening it.` },
				{ status: 409 },
			);
		}
		if (
			checkActiveBranches &&
			localResolution.status === "found" &&
			storedResolution.status === "found" &&
			localResolution.task.id.toLowerCase() !== storedResolution.task.id.toLowerCase()
		) {
			return Response.json(
				{ error: `Task ID ${taskId} is ambiguous. Repair duplicate task IDs before opening it.` },
				{ status: 409 },
			);
		}
		if (localResolution.status === "found") {
			store.upsertTask(localResolution.task);
			return Response.json(localResolution.task);
		}
		if (storedResolution.status === "found") {
			return Response.json(storedResolution.task);
		}

		return Response.json({ error: `Task ${taskId} not found` }, { status: 404 });
	}

	private async handleUpdateTask(req: Request, taskId: string): Promise<Response> {
		const updates = await req.json();
		const existingTask = await this.core.filesystem.loadTask(taskId);
		if (!existingTask) {
			return Response.json({ error: "Task not found" }, { status: 404 });
		}

		const updateInput: TaskUpdateInput = {};

		if ("title" in updates && typeof updates.title === "string") {
			updateInput.title = updates.title;
		}

		if ("description" in updates && typeof updates.description === "string") {
			updateInput.description = updates.description;
		}

		if ("status" in updates && typeof updates.status === "string") {
			updateInput.status = updates.status;
		}

		if ("priority" in updates && typeof updates.priority === "string") {
			updateInput.priority = updates.priority;
		}

		if ("type" in updates && typeof updates.type === "string") {
			updateInput.type = updates.type;
		}

		if ("milestone" in updates && (typeof updates.milestone === "string" || updates.milestone === null)) {
			if (typeof updates.milestone === "string") {
				updateInput.milestone = await this.resolveMilestoneInput(updates.milestone);
			} else {
				updateInput.milestone = updates.milestone;
			}
		}

		if ("labels" in updates && Array.isArray(updates.labels)) {
			updateInput.labels = updates.labels;
		}

		if ("assignee" in updates && Array.isArray(updates.assignee)) {
			updateInput.assignee = updates.assignee;
		}

		if ("dependencies" in updates && Array.isArray(updates.dependencies)) {
			updateInput.dependencies = updates.dependencies;
		}

		if ("references" in updates && Array.isArray(updates.references)) {
			updateInput.references = updates.references;
		}

		if ("modifiedFiles" in updates && Array.isArray(updates.modifiedFiles)) {
			updateInput.modifiedFiles = updates.modifiedFiles;
		}

		if ("implementationPlan" in updates && typeof updates.implementationPlan === "string") {
			updateInput.implementationPlan = updates.implementationPlan;
		}

		if ("implementationNotes" in updates && typeof updates.implementationNotes === "string") {
			updateInput.implementationNotes = updates.implementationNotes;
		}

		if ("commentsAppend" in updates && Array.isArray(updates.commentsAppend)) {
			const author =
				typeof updates.commentAuthor === "string" && updates.commentAuthor.trim().length > 0
					? updates.commentAuthor.trim()
					: undefined;
			updateInput.appendComments = updates.commentsAppend
				.map((body: unknown) => ({
					body: String(body ?? "").trim(),
					...(author && { author }),
				}))
				.filter((comment: { body: string }) => comment.body.length > 0);
		}

		if ("finalSummary" in updates && typeof updates.finalSummary === "string") {
			updateInput.finalSummary = updates.finalSummary;
		}

		if ("acceptanceCriteriaItems" in updates && Array.isArray(updates.acceptanceCriteriaItems)) {
			updateInput.acceptanceCriteria = updates.acceptanceCriteriaItems
				.map((item: { text?: string; checked?: boolean }) => ({
					text: String(item?.text ?? "").trim(),
					checked: Boolean(item?.checked),
				}))
				.filter((item: { text: string }) => item.text.length > 0);
		}

		if ("definitionOfDoneAdd" in updates && Array.isArray(updates.definitionOfDoneAdd)) {
			updateInput.addDefinitionOfDone = updates.definitionOfDoneAdd
				.map((item: unknown) => ({ text: String(item ?? "").trim(), checked: false }))
				.filter((item: { text: string }) => item.text.length > 0);
		}

		if ("definitionOfDoneRemove" in updates && Array.isArray(updates.definitionOfDoneRemove)) {
			updateInput.removeDefinitionOfDone = updates.definitionOfDoneRemove.filter(
				(value: unknown) => typeof value === "number" && Number.isFinite(value),
			);
		}

		if ("definitionOfDoneCheck" in updates && Array.isArray(updates.definitionOfDoneCheck)) {
			updateInput.checkDefinitionOfDone = updates.definitionOfDoneCheck.filter(
				(value: unknown) => typeof value === "number" && Number.isFinite(value),
			);
		}

		if ("definitionOfDoneUncheck" in updates && Array.isArray(updates.definitionOfDoneUncheck)) {
			updateInput.uncheckDefinitionOfDone = updates.definitionOfDoneUncheck.filter(
				(value: unknown) => typeof value === "number" && Number.isFinite(value),
			);
		}

		try {
			const updatedTask = await this.core.updateTaskFromInput(taskId, updateInput);
			return Response.json(updatedTask);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to update task";
			return Response.json({ error: message }, { status: 400 });
		}
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
			const message = error instanceof Error ? error.message : "Failed to complete task";
			console.error("Error completing task:", error);
			return Response.json({ error: message }, { status: 500 });
		}
	}

	private async handleGetStatuses(): Promise<Response> {
		const statuses = await getValidStatuses(this.core);
		return Response.json(statuses);
	}

	// Documentation handlers
	private async handleListDocs(): Promise<Response> {
		try {
			const store = await this.getContentStoreInstance();
			const docs = store.getDocuments();
			const docFiles = docs.map((doc) => ({
				name: doc.path?.split(/[\\/]+/).pop() ?? `${doc.title}.md`,
				id: doc.id,
				title: doc.title,
				type: doc.type,
				path: doc.path,
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
			const doc = await this.core.getDocument(docId);
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
		try {
			const body = await req.json();
			const filename = typeof body?.filename === "string" ? body.filename : undefined;
			const title = typeof body?.title === "string" ? body.title : filename?.replace(/\.md$/i, "");
			if (!title || title.trim().length === 0) {
				return Response.json({ error: "Document title is required" }, { status: 400 });
			}
			const type = parseDocumentType(body?.type);
			const path = parseCreateDocumentPath(body?.path);
			const tags = parseDocumentTags(body?.tags);

			const document = await this.core.createDocumentFromInput({
				title,
				content: typeof body?.content === "string" ? body.content : "",
				type,
				path,
				tags,
			});
			return Response.json({ success: true, ...document }, { status: 201 });
		} catch (error) {
			if (error instanceof SyntaxError) {
				return Response.json({ error: "Invalid request payload" }, { status: 400 });
			}
			if (error instanceof Error && isDocumentValidationError(error)) {
				return Response.json({ error: error.message }, { status: 400 });
			}
			console.error("Error creating document:", error);
			return Response.json({ error: "Failed to create document" }, { status: 500 });
		}
	}

	private async handleUpdateDoc(req: Request, docId: string): Promise<Response> {
		try {
			const body = await req.json();
			const content = typeof body?.content === "string" ? body.content : undefined;
			const title = typeof body?.title === "string" ? body.title : undefined;
			const path = parseUpdateDocumentPath(body?.path);
			const type = parseDocumentType(body?.type);
			const tags = parseDocumentTags(body?.tags);

			if (typeof content !== "string") {
				return Response.json({ error: "Document content is required" }, { status: 400 });
			}

			let normalizedTitle: string | undefined;

			if (typeof title === "string") {
				normalizedTitle = title.trim();
				if (normalizedTitle.length === 0) {
					return Response.json({ error: "Document title cannot be empty" }, { status: 400 });
				}
			}

			const document = await this.core.updateDocumentFromInput({
				id: docId,
				content,
				...(normalizedTitle && { title: normalizedTitle }),
				...(path !== undefined && { path }),
				...(type !== undefined && { type }),
				...(tags !== undefined && { tags }),
			});
			return Response.json({ success: true, ...document });
		} catch (error) {
			if (error instanceof SyntaxError) {
				return Response.json({ error: "Invalid request payload" }, { status: 400 });
			}
			if (error instanceof Error) {
				if (error.message.startsWith("Document not found")) {
					return Response.json({ error: error.message }, { status: 404 });
				}
				if (isDocumentValidationError(error)) {
					return Response.json({ error: error.message }, { status: 400 });
				}
			}
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
			if (isCreateLockError(error)) {
				return Response.json({ error: error.message }, { status: 409 });
			}
			return Response.json({ error: "Failed to promote draft" }, { status: 500 });
		}
	}

	// Milestone handlers
	private async readOptionalJsonBody(req: Request): Promise<Record<string, unknown>> {
		const text = await req.text();
		if (!text.trim()) {
			return {};
		}

		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			throw new BacklogToolError("Request body must be valid JSON.", "VALIDATION_ERROR");
		}

		if (!body || typeof body !== "object" || Array.isArray(body)) {
			throw new BacklogToolError("Request body must be a JSON object.", "VALIDATION_ERROR");
		}

		return body as Record<string, unknown>;
	}

	private getMilestoneMutationMessage(result: { content: Array<{ type: string; text?: string }> }): string {
		return result.content
			.filter((item) => item.type === "text" && typeof item.text === "string")
			.map((item) => item.text)
			.join("\n");
	}

	private milestoneMutationErrorResponse(error: unknown, context: string): Response {
		const status =
			error instanceof BacklogToolError
				? error.code === "NOT_FOUND"
					? 404
					: error.code === "VALIDATION_ERROR"
						? 400
						: 500
				: 500;
		const message = error instanceof Error ? error.message : context;
		if (status === 500) {
			console.error(context, error);
		}
		return Response.json(
			{ error: message, code: error instanceof BacklogToolError ? error.code : "INTERNAL_ERROR" },
			{ status },
		);
	}

	private async handleListMilestones(): Promise<Response> {
		try {
			const milestones = await this.core.filesystem.listMilestones();
			return Response.json(milestones);
		} catch (error) {
			console.error("Error listing milestones:", error);
			return Response.json([]);
		}
	}

	private async handleListArchivedMilestones(): Promise<Response> {
		try {
			const milestones = await this.core.filesystem.listArchivedMilestones();
			return Response.json(milestones);
		} catch (error) {
			console.error("Error listing archived milestones:", error);
			return Response.json([]);
		}
	}

	private async handleGetMilestone(milestoneId: string): Promise<Response> {
		try {
			const milestone = await this.core.filesystem.loadMilestone(milestoneId);
			if (!milestone) {
				return Response.json({ error: "Milestone not found" }, { status: 404 });
			}
			return Response.json(milestone);
		} catch (error) {
			console.error("Error loading milestone:", error);
			return Response.json({ error: "Milestone not found" }, { status: 404 });
		}
	}

	private async handleCreateMilestone(req: Request): Promise<Response> {
		try {
			const body = (await req.json()) as { title?: string; description?: string };
			const title = body.title?.trim();

			if (!title) {
				return Response.json({ error: "Milestone title is required" }, { status: 400 });
			}

			// Check for duplicates
			const existingMilestones = await this.core.filesystem.listMilestones();
			const buildAliasKeys = (value: string): Set<string> => {
				const normalized = value.trim().toLowerCase();
				const keys = new Set<string>();
				if (!normalized) {
					return keys;
				}
				keys.add(normalized);
				if (/^\d+$/.test(normalized)) {
					const numeric = String(Number.parseInt(normalized, 10));
					keys.add(numeric);
					keys.add(`m-${numeric}`);
					return keys;
				}
				const match = normalized.match(/^m-(\d+)$/);
				if (match?.[1]) {
					const numeric = String(Number.parseInt(match[1], 10));
					keys.add(numeric);
					keys.add(`m-${numeric}`);
				}
				return keys;
			};
			const requestedKeys = buildAliasKeys(title);
			const duplicate = existingMilestones.find((milestone) => {
				const milestoneKeys = new Set<string>([...buildAliasKeys(milestone.id), ...buildAliasKeys(milestone.title)]);
				for (const key of requestedKeys) {
					if (milestoneKeys.has(key)) {
						return true;
					}
				}
				return false;
			});
			if (duplicate) {
				return Response.json({ error: "A milestone with this title or ID already exists" }, { status: 400 });
			}

			const milestone = await this.core.filesystem.createMilestone(title, body.description);
			return Response.json(milestone, { status: 201 });
		} catch (error) {
			console.error("Error creating milestone:", error);
			return Response.json({ error: "Failed to create milestone" }, { status: 500 });
		}
	}

	private async handleUpdateMilestone(req: Request, milestoneId: string): Promise<Response> {
		try {
			const body = await this.readOptionalJsonBody(req);
			const title = typeof body.title === "string" ? body.title.trim() : "";
			const updateTasks = typeof body.updateTasks === "boolean" ? body.updateTasks : true;

			if (!title) {
				return Response.json({ error: "Milestone title is required" }, { status: 400 });
			}

			const sourceMilestone = await this.core.filesystem.loadMilestone(milestoneId);
			const result = await new MilestoneHandlers(this.core).renameMilestone({
				from: milestoneId,
				to: title,
				updateTasks,
			});
			const milestone =
				(await this.core.filesystem.loadMilestone(sourceMilestone?.id ?? milestoneId)) ??
				(await this.core.filesystem.loadMilestone(title));
			this.broadcastTasksUpdated();
			return Response.json({
				success: true,
				milestone: milestone ?? null,
				message: this.getMilestoneMutationMessage(result),
			});
		} catch (error) {
			return this.milestoneMutationErrorResponse(error, "Error updating milestone");
		}
	}

	private async handleRemoveMilestone(req: Request, milestoneId: string): Promise<Response> {
		try {
			const body = await this.readOptionalJsonBody(req);
			const rawTaskHandling = body.taskHandling;
			const taskHandling =
				rawTaskHandling === undefined
					? "clear"
					: rawTaskHandling === "clear" || rawTaskHandling === "keep" || rawTaskHandling === "reassign"
						? rawTaskHandling
						: null;
			const reassignTo = typeof body.reassignTo === "string" ? body.reassignTo : undefined;

			if (!taskHandling) {
				return Response.json({ error: "taskHandling must be clear, keep, or reassign" }, { status: 400 });
			}

			const result = await new MilestoneHandlers(this.core).removeMilestone({
				name: milestoneId,
				taskHandling,
				reassignTo,
			});
			this.broadcastTasksUpdated();
			return Response.json({
				success: true,
				message: this.getMilestoneMutationMessage(result),
			});
		} catch (error) {
			return this.milestoneMutationErrorResponse(error, "Error removing milestone");
		}
	}

	private async handleArchiveMilestone(milestoneId: string): Promise<Response> {
		try {
			const result = await this.core.archiveMilestone(milestoneId);
			if (!result.success) {
				return Response.json({ error: "Milestone not found" }, { status: 404 });
			}
			this.broadcastTasksUpdated();
			return Response.json({ success: true, milestone: result.milestone ?? null });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to archive milestone";
			console.error("Error archiving milestone:", error);
			return Response.json({ error: message }, { status: 500 });
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
			const body = await req.json();
			const taskId = typeof body.taskId === "string" ? body.taskId : "";
			const targetStatus = typeof body.targetStatus === "string" ? body.targetStatus : "";
			const orderedTaskIds = Array.isArray(body.orderedTaskIds) ? body.orderedTaskIds : [];
			const targetMilestone =
				typeof body.targetMilestone === "string"
					? body.targetMilestone
					: body.targetMilestone === null
						? null
						: undefined;

			if (!taskId || !targetStatus || orderedTaskIds.length === 0) {
				return Response.json(
					{ error: "Missing required fields: taskId, targetStatus, and orderedTaskIds" },
					{ status: 400 },
				);
			}

			const { updatedTask } = await this.core.reorderTask({
				taskId,
				targetStatus,
				orderedTaskIds,
				targetMilestone,
				commitMessage: `Reorder tasks in ${targetStatus}`,
			});

			return Response.json({ success: true, task: updatedTask });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to reorder task";
			// Cross-branch and validation errors are client errors (400), not server errors (500)
			const isCrossBranchError = message.includes("exists in branch");
			const isValidationError = message.includes("not found") || message.includes("Missing required");
			const status = isCrossBranchError || isValidationError ? 400 : 500;
			if (status === 500) {
				console.error("Error reordering task:", error);
			}
			return Response.json({ error: message }, { status });
		}
	}

	private async handleGetDuplicateTasks(): Promise<Response> {
		try {
			const tasks = await this.core.filesystem.listTasks();
			const groups = detectDuplicateTaskIds(tasks);
			return Response.json(groups);
		} catch (error) {
			return Response.json({ error: String(error) }, { status: 500 });
		}
	}

	private async handleCleanupPreview(req: Request): Promise<Response> {
		try {
			const url = new URL(req.url);
			const ageParam = url.searchParams.get("age");

			if (!ageParam) {
				return Response.json({ error: "Missing age parameter" }, { status: 400 });
			}

			const age = Number.parseInt(ageParam, 10);
			if (Number.isNaN(age) || age < 0) {
				return Response.json({ error: "Invalid age parameter" }, { status: 400 });
			}

			const tasksToCleanup = await this.core.getTerminalStatusTasksByAge(age);

			// Return preview of tasks to be cleaned up
			const preview = tasksToCleanup.map((task) => ({
				id: task.id,
				title: task.title,
				updatedDate: task.updatedDate,
				createdDate: task.createdDate,
			}));

			return Response.json({
				count: preview.length,
				tasks: preview,
			});
		} catch (error) {
			console.error("Error getting cleanup preview:", error);
			return Response.json({ error: "Failed to get cleanup preview" }, { status: 500 });
		}
	}

	private async handleCleanupExecute(req: Request): Promise<Response> {
		try {
			const { age } = await req.json();

			if (age === undefined || age === null) {
				return Response.json({ error: "Missing age parameter" }, { status: 400 });
			}

			const ageInDays = Number.parseInt(age, 10);
			if (Number.isNaN(ageInDays) || ageInDays < 0) {
				return Response.json({ error: "Invalid age parameter" }, { status: 400 });
			}

			const tasksToCleanup = await this.core.getTerminalStatusTasksByAge(ageInDays);

			if (tasksToCleanup.length === 0) {
				return Response.json({
					success: true,
					movedCount: 0,
					message: "No tasks to clean up",
				});
			}

			// Move tasks to completed folder
			let successCount = 0;
			const failedTasks: string[] = [];

			for (const task of tasksToCleanup) {
				try {
					const success = await this.core.completeTask(task.id);
					if (success) {
						successCount++;
					} else {
						failedTasks.push(task.id);
					}
				} catch (error) {
					console.error(`Failed to complete task ${task.id}:`, error);
					failedTasks.push(task.id);
				}
			}

			// Notify listeners to refresh
			this.broadcastTasksUpdated();

			return Response.json({
				success: true,
				movedCount: successCount,
				totalCount: tasksToCleanup.length,
				failedTasks: failedTasks.length > 0 ? failedTasks : undefined,
				message: `Moved ${successCount} of ${tasksToCleanup.length} tasks to completed folder`,
			});
		} catch (error) {
			console.error("Error executing cleanup:", error);
			return Response.json({ error: "Failed to execute cleanup" }, { status: 500 });
		}
	}

	private async handleGetStatistics(): Promise<Response> {
		try {
			// Load tasks using the same logic as CLI overview
			const { tasks, drafts, statuses, priorities } = await this.core.loadAllTasksForStatistics();

			// Calculate statistics using the exact same function as CLI
			const statistics = getTaskStatistics(tasks, drafts, statuses, priorities);

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

	private async handleGetStatus(): Promise<Response> {
		try {
			const config = await this.core.filesystem.loadConfig();
			const backlogResolution = this.core.filesystem.resolveBacklogDirectoryInfo();
			return Response.json({
				initialized: !!config,
				projectPath: this.core.filesystem.rootDir,
				backlogDirectory: backlogResolution.backlogDir,
				backlogDirectorySource: backlogResolution.source,
				configLocation: backlogResolution.configSource,
				rootConfigPath: backlogResolution.rootConfigPath,
			});
		} catch (error) {
			console.error("Error getting status:", error);
			return Response.json({
				initialized: false,
				projectPath: this.core.filesystem.rootDir,
				backlogDirectory: null,
				backlogDirectorySource: null,
				configLocation: null,
				rootConfigPath: null,
			});
		}
	}

	private async handleInit(req: Request): Promise<Response> {
		try {
			const body = await req.json();
			const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
			const backlogDirectory = typeof body.backlogDirectory === "string" ? body.backlogDirectory.trim() : undefined;
			const backlogDirectorySource =
				body.backlogDirectorySource === "backlog" ||
				body.backlogDirectorySource === ".backlog" ||
				body.backlogDirectorySource === "custom"
					? body.backlogDirectorySource
					: undefined;
			const configLocation =
				body.configLocation === "folder" || body.configLocation === "root" ? body.configLocation : undefined;
			const integrationMode = body.integrationMode as "mcp" | "cli" | "none" | undefined;
			const mcpClients = Array.isArray(body.mcpClients) ? body.mcpClients : [];
			const agentInstructions = Array.isArray(body.agentInstructions) ? body.agentInstructions : [];
			const installClaudeAgentFlag = parseOptionalBoolean(body.installClaudeAgent) ?? false;
			const filesystemOnly = parseOptionalBoolean(body.filesystemOnly) ?? false;
			const advancedConfig = body.advancedConfig || {};

			// Input validation (browser layer responsibility)
			if (!projectName) {
				return Response.json({ error: "Project name is required" }, { status: 400 });
			}

			// Check if already initialized (for browser, we don't allow re-init)
			const existingConfig = await this.core.filesystem.loadConfig();
			if (existingConfig) {
				return Response.json({ error: "Project is already initialized" }, { status: 400 });
			}

			// Call shared core init function
			const result = await initializeProject(this.core, {
				projectName,
				backlogDirectory,
				backlogDirectorySource,
				configLocation,
				integrationMode: integrationMode || "none",
				mcpClients,
				agentInstructions,
				installClaudeAgent: installClaudeAgentFlag,
				filesystemOnly,
				advancedConfig,
				existingConfig: null,
			});

			// Update server's project name
			this.projectName = result.projectName;

			// Ensure config watcher is set up now that config file exists
			if (this.contentStore) {
				await this.contentStore.ensureConfigWatcher();
			}

			return Response.json({
				success: result.success,
				projectName: result.projectName,
				mcpResults: result.mcpResults,
			});
		} catch (error) {
			console.error("Error initializing project:", error);
			const message = error instanceof Error ? error.message : "Failed to initialize project";
			return Response.json({ error: message }, { status: 500 });
		}
	}
}
