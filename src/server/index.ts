import { basename, dirname, join } from "node:path";
import type { Server, ServerWebSocket } from "bun";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { ContentStore } from "../core/content-store.ts";
import { initializeProject } from "../core/init.ts";
import { ProjectManager } from "../core/project-manager.ts";
import type { SearchService } from "../core/search-service.ts";
import { getTaskStatistics } from "../core/statistics.ts";
import { isCreateLockError } from "../file-system/operations.ts";
import type {
	ProjectDefinition,
	ResolvedProjectContext,
	SearchPriorityFilter,
	SearchResultType,
	Task,
	TaskUpdateInput,
} from "../types/index.ts";
import { watchConfig } from "../utils/config-watcher.ts";
import { readProjectRegistry, resolveProjectContext } from "../utils/project-registry.ts";
import { getVersion } from "../utils/version.ts";

// Regex pattern to match any prefix (letters followed by dash)
const PREFIX_PATTERN = /^[a-zA-Z]+-/i;
const DEFAULT_PREFIX = "task-";

/**
 * Strip any prefix from an ID (e.g., "task-123" -> "123", "JIRA-456" -> "456")
 */
function stripPrefix(id: string): string {
	return id.replace(PREFIX_PATTERN, "");
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

function parseTaskIdSegments(value: string): number[] | null {
	const withoutPrefix = stripPrefix(value);
	if (!/^[0-9]+(?:\.[0-9]+)*$/.test(withoutPrefix)) {
		return null;
	}
	return withoutPrefix.split(".").map((segment) => Number.parseInt(segment, 10));
}

function findTaskByLooseId(tasks: Task[], inputId: string): Task | undefined {
	// First try exact match (case-insensitive)
	const lowerInputId = inputId.toLowerCase();
	const exact = tasks.find((task) => task.id.toLowerCase() === lowerInputId);
	if (exact) {
		return exact;
	}

	// Try matching by numeric segments only
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
	private readonly projectRoot: string;
	private readonly projectManager: ProjectManager;
	private core: Core;
	private server: Server<unknown> | null = null;
	private projectName = "Untitled Project";
	private sockets = new Set<ServerWebSocket<unknown>>();
	private readonly trackedCores = new Set<Core>();
	private readonly contentStoreSubscriptions = new Map<
		string,
		{ unsubscribe: () => void; storeReadyBroadcasted: boolean }
	>();
	private configWatcher: { stop: () => void } | null = null;
	private readonly initialProject?: string;

	constructor(projectPath: string, options?: { backlogRoot?: string }) {
		this.projectRoot = projectPath;
		this.projectManager = new ProjectManager(projectPath);
		this.core = new Core(projectPath, {
			enableWatchers: true,
			backlogRoot: options?.backlogRoot,
		});
		this.trackedCores.add(this.core);
		this.initialProject = options?.backlogRoot ? basename(options.backlogRoot) : undefined;
	}

	private getCoreSubscriptionKey(core: Core): string {
		return core.filesystem.backlogDir;
	}

	private async ensureServicesReady(core: Core): Promise<{ store: ContentStore; search: SearchService }> {
		const store = await core.getContentStore();
		const subscriptionKey = this.getCoreSubscriptionKey(core);
		const existingSubscription = this.contentStoreSubscriptions.get(subscriptionKey);

		if (!existingSubscription) {
			const subscriptionState = { storeReadyBroadcasted: false };
			const unsubscribe = store.subscribe((event) => {
				if (event.type === "ready") {
					if (!subscriptionState.storeReadyBroadcasted) {
						subscriptionState.storeReadyBroadcasted = true;
						return;
					}
					this.broadcastTasksUpdated();
					return;
				}

				subscriptionState.storeReadyBroadcasted = true;
				this.broadcastTasksUpdated();
			});
			this.contentStoreSubscriptions.set(subscriptionKey, {
				unsubscribe,
				storeReadyBroadcasted: subscriptionState.storeReadyBroadcasted,
			});
		}

		const search = await core.getSearchService();
		this.trackedCores.add(core);
		return { store, search };
	}

	private async getContentStoreInstance(core: Core): Promise<ContentStore> {
		const { store } = await this.ensureServicesReady(core);
		return store;
	}

	private async getSearchServiceInstance(core: Core): Promise<SearchService> {
		const { search } = await this.ensureServicesReady(core);
		return search;
	}

	private async getCoreForRequest(
		req: Request,
		bodyProject?: string,
	): Promise<{ core: Core; context?: ResolvedProjectContext }> {
		const url = new URL(req.url);
		const queryProject = url.searchParams.get("project")?.trim();
		const normalizedBodyProject = bodyProject?.trim();
		const explicitProject = queryProject || normalizedBodyProject;
		const requestedProject = explicitProject || this.initialProject;

		try {
			const context = await resolveProjectContext(this.projectRoot, {
				cwd: this.projectRoot,
				project: requestedProject,
			});
			const core = await this.projectManager.getCore({
				project: context.project.key,
				enableWatchers: true,
			});
			this.trackedCores.add(core);
			return { core, context };
		} catch (error) {
			if (explicitProject) {
				throw error;
			}
			return { core: this.core };
		}
	}

	private projectErrorResponse(error: unknown): Response {
		const message = error instanceof Error ? error.message : "Invalid project";
		return Response.json({ error: message }, { status: 400 });
	}

	private async listProjects(): Promise<Array<ProjectDefinition & { projectName?: string }>> {
		const registry = await readProjectRegistry(this.projectRoot);
		if (!registry) {
			return [];
		}

		return Promise.all(
			registry.projects.map(async (project) => {
				try {
					const core = await this.projectManager.getCore({ project: project.key });
					const config = await core.filesystem.loadConfig();
					return {
						...project,
						...(config?.projectName ? { projectName: config.projectName } : {}),
					};
				} catch {
					return project;
				}
			}),
		);
	}

	private async resolveMilestoneInput(core: Core, milestone: string): Promise<string> {
		const normalized = milestone.trim();
		if (!normalized) {
			return normalized;
		}

		const key = normalized.toLowerCase();
		const aliasKeys = new Set<string>([key]);
		const looksLikeMilestoneId = /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized);
		const canonicalInputId =
			/^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized)
				? `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`
				: null;
		if (/^\d+$/.test(normalized)) {
			const numeric = String(Number.parseInt(normalized, 10));
			aliasKeys.add(numeric);
			aliasKeys.add(`m-${numeric}`);
		} else {
			const match = normalized.match(/^m-(\d+)$/i);
			if (match?.[1]) {
				const numeric = String(Number.parseInt(match[1], 10));
				aliasKeys.add(numeric);
				aliasKeys.add(`m-${numeric}`);
			}
		}
		const [activeMilestones, archivedMilestones] = await Promise.all([
			core.filesystem.listMilestones(),
			core.filesystem.listArchivedMilestones(),
		]);
		const idMatchesAlias = (milestoneId: string): boolean => {
			const idKey = milestoneId.trim().toLowerCase();
			if (aliasKeys.has(idKey)) {
				return true;
			}
			if (/^\d+$/.test(milestoneId.trim())) {
				const numeric = String(Number.parseInt(milestoneId.trim(), 10));
				return aliasKeys.has(numeric) || aliasKeys.has(`m-${numeric}`);
			}
			const idMatch = milestoneId.trim().match(/^m-(\d+)$/i);
			if (!idMatch?.[1]) {
				return false;
			}
			const numeric = String(Number.parseInt(idMatch[1], 10));
			return aliasKeys.has(numeric) || aliasKeys.has(`m-${numeric}`);
		};
		const findIdMatch = (
			milestones: Array<{ id: string; title: string }>,
		): { id: string; title: string } | undefined => {
			const rawExactMatch = milestones.find((item) => item.id.trim().toLowerCase() === key);
			if (rawExactMatch) {
				return rawExactMatch;
			}
			if (canonicalInputId) {
				const canonicalRawMatch = milestones.find((item) => item.id.trim().toLowerCase() === canonicalInputId);
				if (canonicalRawMatch) {
					return canonicalRawMatch;
				}
			}
			return milestones.find((item) => idMatchesAlias(item.id));
		};
		const findUniqueTitleMatch = (
			milestones: Array<{ id: string; title: string }>,
		): { id: string; title: string } | null => {
			const titleMatches = milestones.filter((item) => item.title.trim().toLowerCase() === key);
			if (titleMatches.length === 1) {
				return titleMatches[0] ?? null;
			}
			return null;
		};

		const matchByAlias = (milestones: Array<{ id: string; title: string }>): string | null => {
			const idMatch = findIdMatch(milestones);
			const titleMatch = findUniqueTitleMatch(milestones);
			if (looksLikeMilestoneId) {
				return idMatch?.id ?? null;
			}
			if (titleMatch) {
				return titleMatch.id;
			}
			if (idMatch) {
				return idMatch.id;
			}
			return null;
		};

		const activeTitleMatches = activeMilestones.filter((item) => item.title.trim().toLowerCase() === key);
		const hasAmbiguousActiveTitle = activeTitleMatches.length > 1;
		if (looksLikeMilestoneId) {
			const activeIdMatch = findIdMatch(activeMilestones);
			if (activeIdMatch) {
				return activeIdMatch.id;
			}
			const archivedIdMatch = findIdMatch(archivedMilestones);
			if (archivedIdMatch) {
				return archivedIdMatch.id;
			}
			if (activeTitleMatches.length === 1) {
				return activeTitleMatches[0]?.id ?? normalized;
			}
			if (hasAmbiguousActiveTitle) {
				return normalized;
			}
			const archivedTitleMatch = findUniqueTitleMatch(archivedMilestones);
			return archivedTitleMatch?.id ?? normalized;
		}

		const activeMatch = matchByAlias(activeMilestones);
		if (activeMatch) {
			return activeMatch;
		}
		if (hasAmbiguousActiveTitle) {
			return normalized;
		}

		const archivedMatch = matchByAlias(archivedMilestones);
		if (archivedMatch) {
			return archivedMatch;
		}

		return normalized;
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
		// Load config (migration is handled globally by CLI)
		const config = await this.core.filesystem.loadConfig();

		// Use config default port if no port specified
		const finalPort = port ?? config?.defaultPort ?? 6420;
		this.projectName = config?.projectName || "Untitled Project";

		// Check if browser should open (config setting or CLI override)
		// Default to true if autoOpenBrowser is not explicitly set to false
		const shouldOpenBrowser = openBrowser && (config?.autoOpenBrowser ?? true);

		// Set up config watcher to broadcast changes
		this.configWatcher = watchConfig(this.core, {
			onConfigChanged: () => {
				this.broadcastConfigUpdated();
			},
		});

		try {
			await this.ensureServicesReady(this.core);
			const serveOptions = {
				port: finalPort,
				development: process.env.NODE_ENV === "development",
				routes: {
					"/": indexHtml,
					"/tasks": indexHtml,
					"/milestones": indexHtml,
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
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetTask(req, req.params.id),
					},
					"/api/tasks/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetTask(req, req.params.id),
						PUT: async (req: Request & { params: { id: string } }) => await this.handleUpdateTask(req, req.params.id),
						DELETE: async (req: Request & { params: { id: string } }) =>
							await this.handleDeleteTask(req, req.params.id),
					},
					"/api/tasks/:id/complete": {
						POST: async (req: Request & { params: { id: string } }) =>
							await this.handleCompleteTask(req, req.params.id),
					},
					"/api/statuses": {
						GET: async (req: Request) => await this.handleGetStatuses(req),
					},
					"/api/projects": {
						GET: async () => await this.handleGetProjects(),
					},
					"/api/config": {
						GET: async (req: Request) => await this.handleGetConfig(req),
						PUT: async (req: Request) => await this.handleUpdateConfig(req),
					},
					"/api/docs": {
						GET: async (req: Request) => await this.handleListDocs(req),
						POST: async (req: Request) => await this.handleCreateDoc(req),
					},
					"/api/doc/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDoc(req, req.params.id),
					},
					"/api/docs/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDoc(req, req.params.id),
						PUT: async (req: Request & { params: { id: string } }) => await this.handleUpdateDoc(req, req.params.id),
					},
					"/api/decisions": {
						GET: async (req: Request) => await this.handleListDecisions(req),
						POST: async (req: Request) => await this.handleCreateDecision(req),
					},
					"/api/decision/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDecision(req, req.params.id),
					},
					"/api/decisions/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetDecision(req, req.params.id),
						PUT: async (req: Request & { params: { id: string } }) =>
							await this.handleUpdateDecision(req, req.params.id),
					},
					"/api/drafts": {
						GET: async (req: Request) => await this.handleListDrafts(req),
					},
					"/api/drafts/:id/promote": {
						POST: async (req: Request & { params: { id: string } }) =>
							await this.handlePromoteDraft(req, req.params.id),
					},
					"/api/milestones": {
						GET: async (req: Request) => await this.handleListMilestones(req),
						POST: async (req: Request) => await this.handleCreateMilestone(req),
					},
					"/api/milestones/archived": {
						GET: async (req: Request) => await this.handleListArchivedMilestones(req),
					},
					"/api/milestones/:id": {
						GET: async (req: Request & { params: { id: string } }) => await this.handleGetMilestone(req, req.params.id),
					},
					"/api/milestones/:id/archive": {
						POST: async (req: Request & { params: { id: string } }) =>
							await this.handleArchiveMilestone(req, req.params.id),
					},
					"/api/tasks/reorder": {
						POST: async (req: Request) => await this.handleReorderTask(req),
					},
					"/api/tasks/cleanup": {
						GET: async (req: Request) => await this.handleCleanupPreview(req),
					},
					"/api/tasks/cleanup/execute": {
						POST: async (req: Request) => await this.handleCleanupExecute(req),
					},
					"/api/version": {
						GET: async () => await this.handleGetVersion(),
					},
					"/api/statistics": {
						GET: async (req: Request) => await this.handleGetStatistics(req),
					},
					"/api/status": {
						GET: async (req: Request) => await this.handleGetStatus(req),
					},
					"/api/init": {
						POST: async (req: Request) => await this.handleInit(req),
					},
					"/api/search": {
						GET: async (req: Request) => await this.handleSearch(req),
					},
					"/sequences": {
						GET: async (req: Request) => await this.handleGetSequences(req),
					},
					"/sequences/move": {
						POST: async (req: Request) => await this.handleMoveSequence(req),
					},
					"/api/sequences": {
						GET: async (req: Request) => await this.handleGetSequences(req),
					},
					"/api/sequences/move": {
						POST: async (req: Request) => await this.handleMoveSequence(req),
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
						res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
						res.headers.set("Pragma", "no-cache");
						res.headers.set("Expires", "0");
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

		for (const subscription of this.contentStoreSubscriptions.values()) {
			try {
				subscription.unsubscribe();
			} catch {}
		}
		this.contentStoreSubscriptions.clear();

		// Stop config watcher
		try {
			this.configWatcher?.stop();
			this.configWatcher = null;
		} catch {}

		for (const core of this.trackedCores) {
			core.disposeSearchService();
			core.disposeContentStore();
		}
		this.trackedCores.clear();

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
		const url = new URL(req.url);
		const pathname = url.pathname;

		// Handle WebSocket upgrade
		if (req.headers.get("upgrade") === "websocket") {
			const success = server.upgrade(req, { data: undefined });
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
		try {
			const { core } = await this.getCoreForRequest(req);
			const url = new URL(req.url);
			const status = url.searchParams.get("status") || undefined;
			const assignee = url.searchParams.get("assignee") || undefined;
			const parent = url.searchParams.get("parent") || undefined;
			const priorityParam = url.searchParams.get("priority") || undefined;
			const crossBranch = url.searchParams.get("crossBranch") === "true";
			const labelParams = [...url.searchParams.getAll("label"), ...url.searchParams.getAll("labels")];
			const labelsCsv = url.searchParams.get("labels");
			if (labelsCsv) {
				labelParams.push(...labelsCsv.split(","));
			}
			const labels = labelParams.map((label) => label.trim()).filter((label) => label.length > 0);

			let priority: "high" | "medium" | "low" | undefined;
			if (priorityParam) {
				const normalizedPriority = priorityParam.toLowerCase();
				const allowed = ["high", "medium", "low"];
				if (!allowed.includes(normalizedPriority)) {
					return Response.json({ error: "Invalid priority filter" }, { status: 400 });
				}
				priority = normalizedPriority as "high" | "medium" | "low";
			}

			let parentTaskId: string | undefined;
			if (parent) {
				const store = await this.getContentStoreInstance(core);
				const allTasks = store.getTasks();
				let parentTask = findTaskByLooseId(allTasks, parent);
				if (!parentTask) {
					const fallbackId = ensurePrefix(parent);
					const fallback = await core.filesystem.loadTask(fallbackId);
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

			const tasks = await core.queryTasks({
				filters: { status, assignee, priority, parentTaskId, labels: labels.length > 0 ? labels : undefined },
				includeCrossBranch: crossBranch,
			});

			return Response.json(tasks);
		} catch (error) {
			return this.projectErrorResponse(error);
		}
	}

	private async handleSearch(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const searchService = await this.getSearchServiceInstance(core);
			const url = new URL(req.url);
			const query = url.searchParams.get("query") ?? undefined;
			const limitParam = url.searchParams.get("limit");
			const typeParams = [...url.searchParams.getAll("type"), ...url.searchParams.getAll("types")];
			const statusParams = url.searchParams.getAll("status");
			const priorityParamsRaw = url.searchParams.getAll("priority");
			const labelParamsRaw = [...url.searchParams.getAll("label"), ...url.searchParams.getAll("labels")];
			const labelsCsv = url.searchParams.get("labels");
			if (labelsCsv) {
				labelParamsRaw.push(...labelsCsv.split(","));
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
				priority?: SearchPriorityFilter | SearchPriorityFilter[];
				labels?: string | string[];
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

			if (labelParamsRaw.length > 0) {
				const normalizedLabels = labelParamsRaw.map((value) => value.trim()).filter((value) => value.length > 0);
				if (normalizedLabels.length > 0) {
					filters.labels = normalizedLabels.length === 1 ? normalizedLabels[0] : normalizedLabels;
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
		try {
			const payload = await req.json();
			const bodyProject = typeof payload?.project === "string" ? payload.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);

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

			const milestone =
				typeof payload.milestone === "string" ? await this.resolveMilestoneInput(core, payload.milestone) : undefined;

			const { task: createdTask } = await core.createTaskFromInput({
				title: payload.title,
				description: payload.description,
				status: payload.status,
				priority: payload.priority,
				milestone,
				labels: payload.labels,
				assignee: payload.assignee,
				dependencies: payload.dependencies,
				references: payload.references,
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

	private async handleGetTask(req: Request, taskId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const store = await this.getContentStoreInstance(core);
			const tasks = store.getTasks();
			const task = findTaskByLooseId(tasks, taskId);
			if (!task) {
				const fallbackId = ensurePrefix(taskId);
				const fallback = await core.filesystem.loadTask(fallbackId);
				if (fallback) {
					store.upsertTask(fallback);
					return Response.json(fallback);
				}
				return Response.json({ error: "Task not found" }, { status: 404 });
			}
			return Response.json(task);
		} catch (error) {
			return this.projectErrorResponse(error);
		}
	}

	private async handleUpdateTask(req: Request, taskId: string): Promise<Response> {
		try {
			const updates = await req.json();
			const bodyProject = typeof updates?.project === "string" ? updates.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const existingTask = await core.filesystem.loadTask(taskId);
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

			if ("milestone" in updates && (typeof updates.milestone === "string" || updates.milestone === null)) {
				if (typeof updates.milestone === "string") {
					updateInput.milestone = await this.resolveMilestoneInput(core, updates.milestone);
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

			if ("implementationPlan" in updates && typeof updates.implementationPlan === "string") {
				updateInput.implementationPlan = updates.implementationPlan;
			}

			if ("implementationNotes" in updates && typeof updates.implementationNotes === "string") {
				updateInput.implementationNotes = updates.implementationNotes;
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

			const updatedTask = await core.updateTaskFromInput(taskId, updateInput);
			return Response.json(updatedTask);
		} catch (error) {
			if (error instanceof SyntaxError) {
				return Response.json({ error: "Invalid request payload" }, { status: 400 });
			}
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			const message = error instanceof Error ? error.message : "Failed to update task";
			return Response.json({ error: message }, { status: 400 });
		}
	}

	private async handleDeleteTask(req: Request, taskId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const success = await core.archiveTask(taskId);
			if (!success) {
				return Response.json({ error: "Task not found" }, { status: 404 });
			}
			return Response.json({ success: true });
		} catch (error) {
			return this.projectErrorResponse(error);
		}
	}

	private async handleCompleteTask(req: Request, taskId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const task = await core.filesystem.loadTask(taskId);
			if (!task) {
				return Response.json({ error: "Task not found" }, { status: 404 });
			}

			const success = await core.completeTask(taskId);
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

	private async handleGetStatuses(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || ["To Do", "In Progress", "Done"];
			return Response.json(statuses);
		} catch (error) {
			return this.projectErrorResponse(error);
		}
	}

	// Documentation handlers
	private async handleListDocs(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const store = await this.getContentStoreInstance(core);
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

	private async handleGetDoc(req: Request, docId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const doc = await core.getDocument(docId);
			if (!doc) {
				return Response.json({ error: "Document not found" }, { status: 404 });
			}
			return Response.json(doc);
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			console.error("Error loading document:", error);
			return Response.json({ error: "Document not found" }, { status: 404 });
		}
	}

	private async handleCreateDoc(req: Request): Promise<Response> {
		try {
			const body = await req.json();
			const bodyProject = typeof body?.project === "string" ? body.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const filename = String(body?.filename ?? "");
			const content = String(body?.content ?? "");
			const title = filename.replace(".md", "");
			const document = await core.createDocumentWithId(title, content);
			return Response.json({ success: true, id: document.id }, { status: 201 });
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			console.error("Error creating document:", error);
			return Response.json({ error: "Failed to create document" }, { status: 500 });
		}
	}

	private async handleUpdateDoc(req: Request, docId: string): Promise<Response> {
		try {
			const body = await req.json();
			const bodyProject = typeof body?.project === "string" ? body.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const content = typeof body?.content === "string" ? body.content : undefined;
			const title = typeof body?.title === "string" ? body.title : undefined;

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

			const existingDoc = await core.getDocument(docId);
			if (!existingDoc) {
				return Response.json({ error: "Document not found" }, { status: 404 });
			}

			const nextDoc = normalizedTitle ? { ...existingDoc, title: normalizedTitle } : { ...existingDoc };

			await core.updateDocument(nextDoc, content);
			return Response.json({ success: true });
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			console.error("Error updating document:", error);
			if (error instanceof SyntaxError) {
				return Response.json({ error: "Invalid request payload" }, { status: 400 });
			}
			return Response.json({ error: "Failed to update document" }, { status: 500 });
		}
	}

	// Decision handlers
	private async handleListDecisions(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const store = await this.getContentStoreInstance(core);
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

	private async handleGetDecision(req: Request, decisionId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const store = await this.getContentStoreInstance(core);
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
		try {
			const body = await req.json();
			const bodyProject = typeof body?.project === "string" ? body.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const decision = await core.createDecisionWithTitle(String(body?.title ?? ""));
			return Response.json(decision, { status: 201 });
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			console.error("Error creating decision:", error);
			return Response.json({ error: "Failed to create decision" }, { status: 500 });
		}
	}

	private async handleUpdateDecision(req: Request, decisionId: string): Promise<Response> {
		try {
			const bodyProject = new URL(req.url).searchParams.get("project")?.trim() || undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const content = await req.text();
			await core.updateDecisionFromContent(decisionId, content);
			return Response.json({ success: true });
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			if (error instanceof Error && error.message.includes("not found")) {
				return Response.json({ error: "Decision not found" }, { status: 404 });
			}
			console.error("Error updating decision:", error);
			return Response.json({ error: "Failed to update decision" }, { status: 500 });
		}
	}

	private async handleGetProjects(): Promise<Response> {
		const registry = await readProjectRegistry(this.projectRoot);
		const projects = await this.listProjects();
		return Response.json({
			defaultProject: registry?.defaultProject,
			projects,
		});
	}

	private async handleGetConfig(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const config = await core.filesystem.loadConfig();
			if (!config) {
				return Response.json({ error: "Configuration not found" }, { status: 404 });
			}
			return Response.json(config);
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			console.error("Error loading config:", error);
			return Response.json({ error: "Failed to load configuration" }, { status: 500 });
		}
	}

	private async handleUpdateConfig(req: Request): Promise<Response> {
		try {
			const updatedConfig = await req.json();
			const bodyProject = typeof updatedConfig?.project === "string" ? updatedConfig.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);

			// Validate configuration
			if (!updatedConfig.projectName?.trim()) {
				return Response.json({ error: "Project name is required" }, { status: 400 });
			}

			if (updatedConfig.defaultPort && (updatedConfig.defaultPort < 1 || updatedConfig.defaultPort > 65535)) {
				return Response.json({ error: "Port must be between 1 and 65535" }, { status: 400 });
			}

			// Save configuration
			await core.filesystem.saveConfig(updatedConfig);

			// Update local project name if changed
			if (core === this.core && updatedConfig.projectName !== this.projectName) {
				this.projectName = updatedConfig.projectName;
			}

			// Notify connected clients so that they refresh configuration-dependent data (e.g., statuses)
			this.broadcastTasksUpdated();

			return Response.json(updatedConfig);
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			console.error("Error updating config:", error);
			return Response.json({ error: "Failed to update configuration" }, { status: 500 });
		}
	}

	private handleError(error: Error): Response {
		console.error("Server Error:", error);
		return new Response("Internal Server Error", { status: 500 });
	}

	// Draft handlers
	private async handleListDrafts(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const drafts = await core.filesystem.listDrafts();
			return Response.json(drafts);
		} catch (error) {
			console.error("Error listing drafts:", error);
			return Response.json([]);
		}
	}

	private async handlePromoteDraft(req: Request, draftId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const success = await core.promoteDraft(draftId);
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
	private async handleListMilestones(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const milestones = await core.filesystem.listMilestones();
			return Response.json(milestones);
		} catch (error) {
			console.error("Error listing milestones:", error);
			return Response.json([]);
		}
	}

	private async handleListArchivedMilestones(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const milestones = await core.filesystem.listArchivedMilestones();
			return Response.json(milestones);
		} catch (error) {
			console.error("Error listing archived milestones:", error);
			return Response.json([]);
		}
	}

	private async handleGetMilestone(req: Request, milestoneId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const milestone = await core.filesystem.loadMilestone(milestoneId);
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
			const bodyProject =
				typeof (body as { project?: string }).project === "string" ? (body as { project?: string }).project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const title = body.title?.trim();

			if (!title) {
				return Response.json({ error: "Milestone title is required" }, { status: 400 });
			}

			// Check for duplicates
			const existingMilestones = await core.filesystem.listMilestones();
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

			const milestone = await core.filesystem.createMilestone(title, body.description);
			return Response.json(milestone, { status: 201 });
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unknown project:")) {
				return this.projectErrorResponse(error);
			}
			console.error("Error creating milestone:", error);
			return Response.json({ error: "Failed to create milestone" }, { status: 500 });
		}
	}

	private async handleArchiveMilestone(req: Request, milestoneId: string): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const result = await core.archiveMilestone(milestoneId);
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
			const bodyProject = typeof body?.project === "string" ? body.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
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

			const { updatedTask } = await core.reorderTask({
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

	private async handleCleanupPreview(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const url = new URL(req.url);
			const ageParam = url.searchParams.get("age");

			if (!ageParam) {
				return Response.json({ error: "Missing age parameter" }, { status: 400 });
			}

			const age = Number.parseInt(ageParam, 10);
			if (Number.isNaN(age) || age < 0) {
				return Response.json({ error: "Invalid age parameter" }, { status: 400 });
			}

			// Get Done tasks older than specified days
			const tasksToCleanup = await core.getDoneTasksByAge(age);

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
			const body = await req.json();
			const bodyProject = typeof body?.project === "string" ? body.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const { age } = body;

			if (age === undefined || age === null) {
				return Response.json({ error: "Missing age parameter" }, { status: 400 });
			}

			const ageInDays = Number.parseInt(age, 10);
			if (Number.isNaN(ageInDays) || ageInDays < 0) {
				return Response.json({ error: "Invalid age parameter" }, { status: 400 });
			}

			// Get Done tasks older than specified days
			const tasksToCleanup = await core.getDoneTasksByAge(ageInDays);

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
					const success = await core.completeTask(task.id);
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

	// Sequences handlers
	private async handleGetSequences(req: Request): Promise<Response> {
		try {
			const { core } = await this.getCoreForRequest(req);
			const data = await core.listActiveSequences();
			return Response.json(data);
		} catch (error) {
			return this.projectErrorResponse(error);
		}
	}

	private async handleMoveSequence(req: Request): Promise<Response> {
		try {
			const body = await req.json();
			const bodyProject = typeof body?.project === "string" ? body.project : undefined;
			const { core } = await this.getCoreForRequest(req, bodyProject);
			const taskId = String(body.taskId || "").trim();
			const moveToUnsequenced = Boolean(body.unsequenced === true);
			const targetSequenceIndex = body.targetSequenceIndex !== undefined ? Number(body.targetSequenceIndex) : undefined;

			if (!taskId) return Response.json({ error: "taskId is required" }, { status: 400 });

			const next = await core.moveTaskInSequences({
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

	private async handleGetStatistics(req: Request): Promise<Response> {
		try {
			// Load tasks using the same logic as CLI overview
			const { core } = await this.getCoreForRequest(req);
			const { tasks, drafts, statuses } = await core.loadAllTasksForStatistics();

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

	private async handleGetStatus(req: Request): Promise<Response> {
		try {
			const { core, context } = await this.getCoreForRequest(req);
			const config = await core.filesystem.loadConfig();
			const backlogResolution = core.filesystem.resolveBacklogDirectoryInfo();
			return Response.json({
				initialized: !!config,
				projectPath: core.filesystem.rootDir,
				backlogDirectory: backlogResolution.backlogDir,
				backlogDirectorySource: backlogResolution.source,
				configLocation: backlogResolution.configSource,
				rootConfigPath: backlogResolution.rootConfigPath,
				currentProject: context?.project.key ?? this.initialProject ?? null,
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
			const installClaudeAgentFlag = Boolean(body.installClaudeAgent);
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
				advancedConfig,
				existingConfig: null,
			});

			// Update server's project name
			this.projectName = result.projectName;

			// Ensure config watcher is set up now that config file exists
			const contentStore = await this.getContentStoreInstance(this.core);
			contentStore.ensureConfigWatcher();

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
