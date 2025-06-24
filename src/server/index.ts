import type { Server } from "bun";
import { Core } from "../core/backlog.ts";
// Import static files directly - Bun will embed them automatically
import indexHtml from "./index.html";
import {
	API_ERROR_CODES,
	ConfigSchema,
	CreateTaskSchema,
	UpdateTaskSchema,
} from "./schemas.ts";
import {
	createErrorResponse,
	createJsonResponse,
	createSuccessResponse,
	filterTasks,
	parseQueryParams,
	validateRequestBody,
} from "./utils.ts";

export interface ServerConfig {
	port?: number;
	host?: string;
	development?: boolean;
	maxPortRetries?: number;
}

export interface ServerInfo {
	port: number;
	host: string;
	url: string;
}

export class BacklogServer {
	private core: Core;
	private server: Server | null = null;
	private config: Required<ServerConfig>;

	constructor(projectRoot: string, config: ServerConfig = {}) {
		this.core = new Core(projectRoot);
		this.config = {
			port: config.port ?? 3000,
			host: config.host ?? "localhost",
			development: config.development ?? false,
			maxPortRetries: config.maxPortRetries ?? 10,
		};
	}

	private async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;

		// Health check endpoint
		if (pathname === "/health") {
			return createJsonResponse(
				createSuccessResponse({
					status: "ok",
					timestamp: new Date().toISOString(),
					server: "Backlog.md HTTP Server",
				}),
			);
		}

		// API routes
		if (pathname.startsWith("/api/")) {
			return this.handleApiRequest(request);
		}

		// Not found
		return new Response("Not found", { status: 404 });
	}

	private async handleApiRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;
		const method = request.method;

		try {
			// Parse JSON body for POST/PUT requests
			let body: any = null;
			if (method === "POST" || method === "PUT") {
				const contentType = request.headers.get("content-type");
				if (contentType?.includes("application/json")) {
					try {
						body = await request.json();
					} catch {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INVALID_INPUT,
								"Invalid JSON in request body",
							),
							400,
						);
					}
				}
			}

			// Route API requests
			if (pathname === "/api/tasks") {
				if (method === "GET") {
					const allTasks = await this.core.filesystem.listTasks();
					const queryParams = parseQueryParams(url);
					const filteredTasks = filterTasks(allTasks, queryParams);
					return createJsonResponse(createSuccessResponse(filteredTasks));
				}

				if (method === "POST") {
					if (!body) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INVALID_INPUT,
								"Request body required",
							),
							400,
						);
					}

					const validation = validateRequestBody(CreateTaskSchema, body);
					if (!validation.success) {
						return createJsonResponse(validation.error, 422);
					}

					try {
						const taskId = await this.core.createTask(validation.data, false);
						const task = await this.core.filesystem.loadTask(taskId);
						return createJsonResponse(createSuccessResponse(task), 201);
					} catch (error) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INTERNAL_ERROR,
								`Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`,
							),
							500,
						);
					}
				}
			}

			// Single task operations
			const taskMatch = pathname.match(/^\/api\/tasks\/(.+)$/);
			if (taskMatch) {
				const taskId = taskMatch[1];

				if (method === "GET") {
					const task = await this.core.filesystem.loadTask(taskId);
					if (!task) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.TASK_NOT_FOUND,
								`Task with ID ${taskId} not found`,
							),
							404,
						);
					}
					return createJsonResponse(createSuccessResponse(task));
				}

				if (method === "PUT") {
					if (!body) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INVALID_INPUT,
								"Request body required",
							),
							400,
						);
					}

					const validation = validateRequestBody(UpdateTaskSchema, body);
					if (!validation.success) {
						return createJsonResponse(validation.error, 422);
					}

					// Check if task exists first
					const existingTask = await this.core.filesystem.loadTask(taskId);
					if (!existingTask) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.TASK_NOT_FOUND,
								`Task with ID ${taskId} not found`,
							),
							404,
						);
					}

					// Merge the updates with existing task data
					const updatedTaskData = {
						...existingTask,
						...validation.data,
						id: taskId,
					};

					try {
						await this.core.updateTask(updatedTaskData, false);
						const updatedTask = await this.core.filesystem.loadTask(taskId);
						return createJsonResponse(createSuccessResponse(updatedTask));
					} catch (error) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INTERNAL_ERROR,
								`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`,
							),
							500,
						);
					}
				}

				if (method === "DELETE") {
					try {
						const success = await this.core.archiveTask(taskId, false);
						if (!success) {
							return createJsonResponse(
								createErrorResponse(
									API_ERROR_CODES.TASK_NOT_FOUND,
									`Task with ID ${taskId} not found or already archived`,
								),
								404,
							);
						}
						return createJsonResponse(
							createSuccessResponse({ taskId, archived: true }),
						);
					} catch (error) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INTERNAL_ERROR,
								`Failed to archive task: ${error instanceof Error ? error.message : "Unknown error"}`,
							),
							500,
						);
					}
				}
			}

			// Draft promotion endpoint
			const draftPromoteMatch = pathname.match(
				/^\/api\/drafts\/(.+)\/promote$/,
			);
			if (draftPromoteMatch && method === "POST") {
				const draftId = draftPromoteMatch[1];

				try {
					const success = await this.core.promoteDraft(draftId, false);
					if (!success) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.DRAFT_NOT_FOUND,
								`Draft with ID ${draftId} not found`,
							),
							404,
						);
					}

					// Get the promoted task
					const promotedTask = await this.core.filesystem.loadTask(draftId);
					return createJsonResponse(createSuccessResponse(promotedTask));
				} catch (error) {
					return createJsonResponse(
						createErrorResponse(
							API_ERROR_CODES.PROMOTION_FAILED,
							`Failed to promote draft: ${error instanceof Error ? error.message : "Unknown error"}`,
						),
						500,
					);
				}
			}

			// Board endpoint
			if (pathname === "/api/board" && method === "GET") {
				const tasks = await this.core.filesystem.listTasks();
				const config = await this.core.filesystem.loadConfig();
				const statuses = config?.statuses || ["To Do", "In Progress", "Done"];

				return createJsonResponse(createSuccessResponse({ tasks, statuses }));
			}

			// Drafts endpoint
			if (pathname === "/api/drafts" && method === "GET") {
				const drafts = await this.core.filesystem.listDrafts();
				return createJsonResponse(createSuccessResponse(drafts));
			}

			// Configuration endpoint
			if (pathname === "/api/config") {
				if (method === "GET") {
					const config = await this.core.filesystem.loadConfig();
					return createJsonResponse(createSuccessResponse(config));
				}

				if (method === "PUT") {
					if (!body) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INVALID_INPUT,
								"Request body required",
							),
							400,
						);
					}

					const validation = validateRequestBody(ConfigSchema, body);
					if (!validation.success) {
						return createJsonResponse(validation.error, 422);
					}

					try {
						await this.core.filesystem.saveConfig(validation.data);
						return createJsonResponse(createSuccessResponse(validation.data));
					} catch (error) {
						return createJsonResponse(
							createErrorResponse(
								API_ERROR_CODES.INTERNAL_ERROR,
								`Failed to save configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
							),
							500,
						);
					}
				}
			}

			// Route not found
			return createJsonResponse(
				createErrorResponse(
					API_ERROR_CODES.INVALID_INPUT,
					"API endpoint not found",
				),
				404,
			);
		} catch (error) {
			console.error("API Error:", error);
			return createJsonResponse(
				createErrorResponse(
					API_ERROR_CODES.INTERNAL_ERROR,
					`Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
				500,
			);
		}
	}

	async start(): Promise<ServerInfo> {
		let selectedPort = this.config.port;
		let portRetries = 0;

		// Try to find an available port
		while (portRetries < this.config.maxPortRetries) {
			try {
				// Try to start the server directly with routes
				this.server = Bun.serve({
					port: selectedPort,
					hostname: this.config.host,
					fetch: this.handleRequest.bind(this),
					routes: {
						"/": indexHtml,
					},
				});

				// If we got here, the port is available
				const serverInfo: ServerInfo = {
					port: selectedPort,
					host: this.config.host,
					url: `http://${this.config.host}:${selectedPort}`,
				};

				if (selectedPort !== this.config.port) {
					console.log(
						`⚠️  Port ${this.config.port} was busy, using port ${selectedPort} instead`,
					);
				}

				return serverInfo;
			} catch (error) {
				// Port is busy, try next one
				if (this.server) {
					this.server.stop();
					this.server = null;
				}
				selectedPort++;
				portRetries++;
			}
		}

		throw new Error(
			`No available ports found after trying ${this.config.maxPortRetries} ports starting from ${this.config.port}`,
		);
	}

	async stop(): Promise<void> {
		if (this.server) {
			this.server.stop();
			this.server = null;
		}
	}

	isRunning(): boolean {
		return this.server !== null;
	}

	getUrl(): string | null {
		if (!this.server) return null;
		return `http://${this.config.host}:${this.server.port}`;
	}
}
