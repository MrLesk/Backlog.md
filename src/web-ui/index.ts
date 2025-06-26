import { join } from "node:path";
// Import the HTML file from Vite build output
import home from "../../dist/index.html";
import { Core } from "../index.ts";

interface ServerConfig {
	port: number;
	host: string;
	development: boolean;
}

interface ServerInfo {
	url: string;
	port: number;
	host: string;
}

export class BacklogServer {
	private core: Core;
	private config: ServerConfig;
	private server: ReturnType<typeof Bun.serve> | null = null;

	constructor(
		private projectPath: string,
		config: Partial<ServerConfig> = {},
	) {
		this.core = new Core(projectPath);
		this.config = {
			port: config.port || 3000,
			host: config.host || "localhost",
			development: config.development || false,
		};
	}

	async start(): Promise<ServerInfo> {
		let { port, host } = this.config;

		for (let i = 0; i < 10; i++) {
			try {
				this.server = Bun.serve({
					port,
					hostname: host,
					fetch: this.handleRequest.bind(this),
					error: this.handleError.bind(this),
				});

				const url = `http://${this.server.hostname}:${this.server.port}`;
				return { url, port: this.server.port!, host: this.server.hostname! };
			} catch (error) {
				if (
					error instanceof Error &&
					"code" in error &&
					error.code === "EADDRINUSE"
				) {
					console.warn(`⚠️ Port ${port} is in use, trying next port...`);
					port++;
				} else {
					throw error;
				}
			}
		}

		throw new Error("❌ No available ports found after 10 attempts.");
	}

	async stop(): Promise<void> {
		if (this.server) {
			this.server.stop();
			this.server = null;
			console.log("🛑 Server stopped.");
		}
	}

	private async handleRequest(req: Request): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname.startsWith("/api/")) {
			return this.handleApiRequest(req);
		}

		// Handle static assets from the dist directory
		if (url.pathname === "/assets/logo.png") {
			const file = Bun.file("dist/assets/logo.png");
			return new Response(file, {
				headers: { "Content-Type": "image/png" },
			});
		}
		if (url.pathname === "/assets/index.css") {
			const file = Bun.file("dist/assets/index.css");
			return new Response(file, {
				headers: { "Content-Type": "text/css" },
			});
		}
		if (url.pathname === "/assets/index.js") {
			const file = Bun.file("dist/assets/index.js");
			return new Response(file, {
				headers: { "Content-Type": "application/javascript" },
			});
		}

		// For all other requests, delegate to the HTMLBundle's fetch handler
		return (home as any).fetch(req);
	}

	private async handleApiRequest(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const path = url.pathname.replace("/api/", "");

		try {
			if (path === "board") {
				const tasks = await this.core.filesystem.listTasks();
				const config = await this.core.filesystem.loadConfig();
				const statuses = config?.statuses || [];
				return new Response(
					JSON.stringify({ success: true, data: { tasks, statuses } }),
					{ headers: { "Content-Type": "application/json" } },
				);
			}

			if (path.startsWith("tasks/")) {
				const taskId = path.split("/")[1];
				if (req.method === "PUT") {
					const body = await req.json();
					const task = await this.core.filesystem.loadTask(taskId);
					if (task) {
						Object.assign(task, body);
						await this.core.updateTask(task, true);
						return new Response(JSON.stringify({ success: true, data: task }), {
							headers: { "Content-Type": "application/json" },
						});
					}
				}
			}
		} catch (error) {
			return new Response(
				JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(
			JSON.stringify({ success: false, error: "Not Found" }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}

	private handleError(error: Error): Response {
		console.error("❌ Server error:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal Server Error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}
