import type { Server } from "bun";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { getVersion } from "../utils/version.ts";
import favicon from "../web/favicon.png" with { type: "file" };
import indexHtml from "../web/index.html";

export class BacklogServer {
	private core: Core;
	private server: Server | null = null;
	private projectName = "Untitled Project";

	constructor(projectPath: string) {
		this.core = new Core(projectPath);
	}

	async start(port?: number, openBrowser = true): Promise<void> {
		// Load config (migration is handled globally by CLI)
		const config = await this.core.filesystem.loadConfig();

		// Use config default port if no port specified
		const finalPort = port ?? config?.defaultPort ?? 6420;
		this.projectName = config?.projectName || "Untitled Project";

		// Check if browser should open (config setting or CLI override)
		// Default to true if autoOpenBrowser is not explicitly set to false
		const shouldOpenBrowser = openBrowser && (config?.autoOpenBrowser ?? true);

		try {
			this.server = Bun.serve({
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
					"/settings": indexHtml,

					// API Routes using Bun's native route syntax
					"/api/tasks": {
						GET: async (req) => await this.handleListTasks(req),
						POST: async (req) => await this.handleCreateTask(req),
					},
					"/api/task/:id": {
						GET: async (req) => await this.handleGetTask(req.params.id),
					},
					"/api/tasks/:id": {
						GET: async (req) => await this.handleGetTask(req.params.id),
						PUT: async (req) => await this.handleUpdateTask(req, req.params.id),
						DELETE: async (req) => await this.handleDeleteTask(req.params.id),
					},
					"/api/statuses": {
						GET: async () => await this.handleGetStatuses(),
					},
					"/api/config": {
						GET: async () => await this.handleGetConfig(),
						PUT: async (req) => await this.handleUpdateConfig(req),
					},
					"/api/docs": {
						GET: async () => await this.handleListDocs(),
						POST: async (req) => await this.handleCreateDoc(req),
					},
					"/api/doc/:id": {
						GET: async (req) => await this.handleGetDoc(req.params.id),
					},
					"/api/docs/:id": {
						GET: async (req) => await this.handleGetDoc(req.params.id),
						PUT: async (req) => await this.handleUpdateDoc(req, req.params.id),
					},
					"/api/decisions": {
						GET: async () => await this.handleListDecisions(),
						POST: async (req) => await this.handleCreateDecision(req),
					},
					"/api/decision/:id": {
						GET: async (req) => await this.handleGetDecision(req.params.id),
					},
					"/api/decisions/:id": {
						GET: async (req) => await this.handleGetDecision(req.params.id),
						PUT: async (req) => await this.handleUpdateDecision(req, req.params.id),
					},
					"/api/drafts": {
						GET: async () => await this.handleListDrafts(),
					},
					"/api/drafts/:id/promote": {
						POST: async (req) => await this.handlePromoteDraft(req.params.id),
					},
					"/api/tasks/reorder": {
						POST: async (req) => await this.handleReorderTask(req),
					},
					"/api/version": {
						GET: async () => await this.handleGetVersion(),
					},
				},
				fetch: async (req, server) => {
					return await this.handleRequest(req, server);
				},
				error: this.handleError.bind(this),
				websocket: {
					open() {
						// Client connected
					},
					message(ws) {
						// Echo back for health check
						ws.send("pong");
					},
					close() {
						// Client disconnected
					},
				},
			});

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
			const errorCode = (error as any)?.code;
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

	async stop(): Promise<void> {
		if (this.server) {
			await this.server.stop();
			this.server = null;
			console.log("Server stopped");
		}
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
		const status = url.searchParams.get("status");
		const assignee = url.searchParams.get("assignee");
		const parent = url.searchParams.get("parent");

		let tasks = await this.core.filesystem.listTasks();

		if (status) {
			const statusLower = status.toLowerCase();
			tasks = tasks.filter((t) => t.status.toLowerCase() === statusLower);
		}
		if (assignee) {
			tasks = tasks.filter((t) => t.assignee.includes(assignee));
		}
		if (parent) {
			const parentId = parent.startsWith("task-") ? parent : `task-${parent}`;
			const parentTask = await this.core.filesystem.loadTask(parentId);
			if (!parentTask) {
				return Response.json({ error: `Parent task ${parentId} not found` }, { status: 404 });
			}
			tasks = tasks.filter((t) => t.parentTaskId === parentId);
		}

		return Response.json(tasks);
	}

	private async handleCreateTask(req: Request): Promise<Response> {
		const taskData = await req.json();
		const task = await this.core.createTaskFromData(taskData);
		return Response.json(task, { status: 201 });
	}

	private async handleGetTask(taskId: string): Promise<Response> {
		const task = await this.core.filesystem.loadTask(taskId);
		if (!task) {
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

	private async handleGetStatuses(): Promise<Response> {
		const config = await this.core.filesystem.loadConfig();
		const statuses = config?.statuses || ["To Do", "In Progress", "Done"];
		return Response.json(statuses);
	}

	// Documentation handlers
	private async handleListDocs(): Promise<Response> {
		try {
			const docs = await this.core.filesystem.listDocuments();
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
			const docs = await this.core.filesystem.listDocuments();
			const doc = docs.find((d) => d.id === docId || d.title === docId);

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
			const docs = await this.core.filesystem.listDocuments();
			const existingDoc = docs.find((d) => d.id === docId || d.title === docId);

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
			const decisions = await this.core.filesystem.listDecisions();
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
			const decision = await this.core.filesystem.loadDecision(decisionId);

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
}
