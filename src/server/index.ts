import type { Server } from "bun";
import matter from "gray-matter";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import indexHtml from "../web/index.html";

export class BacklogServer {
	private core: Core;
	private server: Server | null = null;
	private projectName = "Untitled Project";

	constructor(private projectPath: string) {
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
				development: true,
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
					"/api/health": {
						GET: async () => await this.handleHealthCheck(),
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
				},
				fetch: async (req, server) => {
					// Apply CORS headers to all responses
					const response = await this.handleRequest(req, server);
					if (response && req.url.includes("/api/")) {
						response.headers.set("Access-Control-Allow-Origin", "*");
						response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
						response.headers.set("Access-Control-Allow-Headers", "Content-Type");
					}
					return response;
				},
				error: this.handleError.bind(this),
				websocket: {
					open(_ws) {
						// Silent - no need to log normal connections
					},
					message(_ws, _message) {
						// No need to handle messages for simple connection monitoring
					},
					close(_ws) {
						// Silent - no need to log normal disconnections
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
			this.server.stop();
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

			await Bun.spawn(cmd, {
				stdio: ["ignore", "ignore", "ignore"],
			});
		} catch (error) {
			console.warn("⚠️  Failed to open browser automatically:", error);
			console.log("💡 Please open your browser manually and navigate to the URL above");
		}
	}

	private async handleRequest(req: Request, server: Server): Promise<Response> {
		const url = new URL(req.url);
		const method = req.method;
		const pathname = url.pathname;

		// Handle WebSocket upgrade
		if (req.headers.get("upgrade") === "websocket") {
			const success = server.upgrade(req);
			if (success) {
				return new Response(null, { status: 101 }); // WebSocket upgrade successful
			}
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		// CORS headers for API requests
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		// Handle CORS preflight
		if (method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// The new route syntax handles API routes, so we just need CORS for non-route paths
		if (pathname.startsWith("/api")) {
			// This should only be reached for unmatched API routes
			return new Response(JSON.stringify({ error: "Not Found" }), {
				status: 404,
				headers: {
					"Content-Type": "application/json",
					...corsHeaders,
				},
			});
		}

		// Serve static assets using Bun.serve with build
		if (
			pathname.startsWith("/assets/") ||
			pathname.endsWith(".js") ||
			pathname.endsWith(".css") ||
			pathname.endsWith(".tsx")
		) {
			// Handle specific static files
			if (pathname === "/styles/style.css") {
				const cssFile = Bun.file("src/web/styles/style.css");
				if (await cssFile.exists()) {
					return new Response(await cssFile.text(), {
						headers: { "Content-Type": "text/css" },
					});
				}
			}

			if (pathname === "/main.tsx") {
				// Bundle the main.tsx file with CSS support
				const build = await Bun.build({
					entrypoints: ["src/web/main.tsx"],
					format: "esm",
					target: "browser",
					minify: false, // Keep readable for debugging
				});

				if (build.success && build.outputs.length > 0) {
					return new Response(await build.outputs[0]!.text(), {
						headers: { "Content-Type": "application/javascript" },
					});
				}
			}

			// Handle assets directory files
			if (pathname.startsWith("/assets/")) {
				const assetPath = `src/web${pathname}`;
				const assetFile = Bun.file(assetPath);
				if (await assetFile.exists()) {
					const contentType = pathname.endsWith(".js") ? "application/javascript" : "text/plain";
					return new Response(await assetFile.text(), {
						headers: { "Content-Type": contentType },
					});
				}
			}

			return new Response("Not Found", { status: 404 });
		}

		// For all other routes, return 404
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
		const id = await this.generateNextId();

		const task: Task = {
			id,
			title: taskData.title,
			body: taskData.body || "",
			status: taskData.status || "",
			assignee: taskData.assignee || [],
			labels: taskData.labels || [],
			dependencies: taskData.dependencies || [],
			createdDate: new Date().toISOString().split("T")[0] || new Date().toISOString().slice(0, 10),
			...(taskData.parentTaskId && { parentTaskId: taskData.parentTaskId }),
			...(taskData.priority && { priority: taskData.priority }),
		};

		await this.core.createTask(task, await this.shouldAutoCommit());
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

		await this.core.updateTask(updatedTask, await this.shouldAutoCommit());
		return Response.json(updatedTask);
	}

	private async handleDeleteTask(taskId: string): Promise<Response> {
		const success = await this.core.archiveTask(taskId, await this.shouldAutoCommit());
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
			const document = await this.core.createDocumentWithId(title, content, await this.shouldAutoCommit());
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

			const updatedDoc = {
				...existingDoc,
				body: content,
				updatedDate: new Date().toISOString().split("T")[0],
			};

			await this.core.createDocument(updatedDoc, await this.shouldAutoCommit());
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
			const decision = await this.core.createDecisionWithTitle(title, await this.shouldAutoCommit());
			return Response.json(decision, { status: 201 });
		} catch (error) {
			console.error("Error creating decision:", error);
			return Response.json({ error: "Failed to create decision" }, { status: 500 });
		}
	}

	private async handleUpdateDecision(req: Request, decisionId: string): Promise<Response> {
		const content = await req.text();

		try {
			const existingDecision = await this.core.filesystem.loadDecision(decisionId);

			if (!existingDecision) {
				return Response.json({ error: "Decision not found" }, { status: 404 });
			}

			// Parse the markdown content to extract the decision data
			const { data } = matter(content);
			const updatedDecision = {
				...existingDecision,
				title: data.title || existingDecision.title,
				status: data.status || existingDecision.status,
				date: data.date || existingDecision.date,
				context: this.extractSection(content, "Context") || existingDecision.context,
				decision: this.extractSection(content, "Decision") || existingDecision.decision,
				consequences: this.extractSection(content, "Consequences") || existingDecision.consequences,
				alternatives: this.extractSection(content, "Alternatives") || existingDecision.alternatives,
			};

			await this.core.createDecision(updatedDecision, await this.shouldAutoCommit());
			return Response.json({ success: true });
		} catch (error) {
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

	private async generateNextId(): Promise<string> {
		const tasks = await this.core.filesystem.listTasks();
		const drafts = await this.core.filesystem.listDrafts();
		const all = [...tasks, ...drafts];

		let max = 0;
		for (const t of all) {
			const match = t.id.match(/^task-(\d+)/);
			if (match) {
				const num = Number.parseInt(match[1] || "0", 10);
				if (num > max) max = num;
			}
		}

		return `task-${max + 1}`;
	}

	private async shouldAutoCommit(overrideValue?: boolean): Promise<boolean> {
		// If override is explicitly provided, use it
		if (overrideValue !== undefined) {
			return overrideValue;
		}
		// Otherwise, check config (default to false for safety)
		const config = await this.core.filesystem.loadConfig();
		return config?.autoCommit ?? false;
	}

	private extractSection(content: string, sectionName: string): string | undefined {
		const regex = new RegExp(`## ${sectionName}\\s*([\\s\\S]*?)(?=## |$)`, "i");
		const match = content.match(regex);
		return match ? match[1]!.trim() : undefined;
	}

	private async handleHealthCheck(): Promise<Response> {
		const startTime = performance.now();

		try {
			// Check filesystem
			const config = await this.core.filesystem.loadConfig();

			const responseTime = Math.round(performance.now() - startTime);

			const healthData = {
				status: "healthy",
				timestamp: new Date().toISOString(),
				responseTime,
				project: this.projectName,
				checks: {
					filesystem: "ok",
					config: config ? "ok" : "warning",
				},
			};

			return Response.json(healthData, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				},
			});
		} catch (error) {
			const responseTime = Math.round(performance.now() - startTime);

			const healthData = {
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				responseTime,
				project: this.projectName,
				checks: {
					filesystem: "error",
					config: "error",
				},
				error: error instanceof Error ? error.message : "Unknown error",
			};

			return Response.json(healthData, {
				status: 503,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				},
			});
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
}
