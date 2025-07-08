import type { Server } from "bun";
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

		this.server = Bun.serve({
			port: finalPort,
			development: true,
			routes: {
				"/": indexHtml,
			},
			fetch: this.handleRequest.bind(this),
			error: this.handleError.bind(this),
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

	private async handleRequest(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const method = req.method;
		const pathname = url.pathname;

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

		// API Routes
		if (pathname.startsWith("/api")) {
			try {
				const response = await this.handleApiRequest(req, pathname, method);
				// Add CORS headers to API responses
				Object.entries(corsHeaders).forEach(([key, value]) => {
					response.headers.set(key, value);
				});
				return response;
			} catch (error) {
				console.error("API Error:", error);
				return new Response(JSON.stringify({ error: "Internal server error" }), {
					status: 500,
					headers: {
						"Content-Type": "application/json",
						...corsHeaders,
					},
				});
			}
		}

		// Serve static assets
		if (pathname.startsWith("/assets/") || pathname.endsWith(".js") || pathname.endsWith(".css")) {
			// In development, Bun's HTML imports should handle this automatically
			// For now, return 404 as the assets should be bundled
			return new Response("Not Found", { status: 404 });
		}

		// For non-API routes, return 404
		return new Response("Not Found", { status: 404 });
	}

	private async handleApiRequest(req: Request, pathname: string, method: string): Promise<Response> {
		// GET /api/health - Health check endpoint
		if (pathname === "/api/health" && method === "GET") {
			try {
				// Basic health checks
				const startTime = Date.now();

				// Check if we can load the config
				const config = await this.core.filesystem.loadConfig();

				// Check if we can list tasks (filesystem accessibility)
				await this.core.filesystem.listTasks();

				const responseTime = Date.now() - startTime;

				return Response.json({
					status: "healthy",
					timestamp: new Date().toISOString(),
					responseTime,
					project: config?.projectName || "Untitled Project",
					checks: {
						filesystem: "ok",
						config: "ok",
					},
				});
			} catch (error) {
				return Response.json(
					{
						status: "unhealthy",
						timestamp: new Date().toISOString(),
						error: error instanceof Error ? error.message : "Unknown error",
						checks: {
							filesystem: "error",
							config: "error",
						},
					},
					{ status: 503 },
				);
			}
		}

		// GET /api/tasks - List all tasks
		if (pathname === "/api/tasks" && method === "GET") {
			const tasks = await this.core.filesystem.listTasks();
			return Response.json(tasks);
		}

		// POST /api/tasks - Create new task
		if (pathname === "/api/tasks" && method === "POST") {
			const taskData = await req.json();
			const id = await this.generateNextId();

			const task: Task = {
				id,
				title: taskData.title,
				description: taskData.description || "",
				status: taskData.status || "",
				assignee: taskData.assignee || [],
				labels: taskData.labels || [],
				dependencies: taskData.dependencies || [],
				createdDate: new Date().toISOString().split("T")[0] || new Date().toISOString().slice(0, 10),
				...(taskData.parentTaskId && { parentTaskId: taskData.parentTaskId }),
				...(taskData.priority && { priority: taskData.priority }),
			};

			await this.core.createTask(task, false);
			return Response.json(task, { status: 201 });
		}

		// GET /api/tasks/:id - Get specific task
		const taskIdMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
		if (taskIdMatch && method === "GET") {
			const taskId = taskIdMatch[1];
			const task = await this.core.filesystem.loadTask(taskId);

			if (!task) {
				return Response.json({ error: "Task not found" }, { status: 404 });
			}

			return Response.json(task);
		}

		// PUT /api/tasks/:id - Update task
		if (taskIdMatch && method === "PUT") {
			const taskId = taskIdMatch[1];
			const updates = await req.json();

			const existingTask = await this.core.filesystem.loadTask(taskId);
			if (!existingTask) {
				return Response.json({ error: "Task not found" }, { status: 404 });
			}

			const updatedTask: Task = {
				...existingTask,
				...updates,
			};

			await this.core.updateTask(updatedTask, false);
			return Response.json(updatedTask);
		}

		// DELETE /api/tasks/:id - Delete task
		if (taskIdMatch && method === "DELETE") {
			const taskId = taskIdMatch[1];
			const success = await this.core.archiveTask(taskId, false);

			if (!success) {
				return Response.json({ error: "Task not found" }, { status: 404 });
			}

			return Response.json({ success: true });
		}

		// GET /api/statuses - Get available statuses
		if (pathname === "/api/statuses" && method === "GET") {
			const config = await this.core.filesystem.loadConfig();
			const statuses = config?.statuses || ["To Do", "In Progress", "Done"];
			return Response.json(statuses);
		}

		// GET /api/config - Get project configuration
		if (pathname === "/api/config" && method === "GET") {
			return Response.json({
				projectName: this.projectName,
			});
		}

		return new Response("Not Found", { status: 404 });
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

	private handleError(error: Error): Response {
		console.error("Server Error:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
}
