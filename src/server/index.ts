import { serve } from "bun";
import { Core } from "../core/backlog.ts";
// Import HTML file - Bun will automatically bundle all referenced assets
import indexHtml from "./index.html";
import {
	API_ERROR_CODES,
	ConfigSchema,
	CreateTaskSchema,
	UpdateTaskSchema,
} from "./schemas.ts";
import {
	createErrorResponse,
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

// Handler functions for API routes
// These functions contain the actual logic for each endpoint, keeping the routes clean and organized

async function handleHealthCheck() {
	return Response.json({
		success: true,
		data: {
			status: "ok",
			timestamp: new Date().toISOString(),
			server: "Backlog.md HTTP Server",
		},
	});
}

async function handleGetTasks(core: Core, req: Request) {
	const url = new URL(req.url);
	const allTasks = await core.filesystem.listTasks();
	const queryParams = parseQueryParams(url);
	const filteredTasks = filterTasks(allTasks, queryParams);
	return Response.json(createSuccessResponse(filteredTasks));
}

async function handleCreateTask(core: Core, req: Request) {
	try {
		const body = await req.json();
		const validation = validateRequestBody(CreateTaskSchema, body);
		if (!validation.success) {
			return Response.json(validation.error, { status: 422 });
		}

		const taskId = await core.createTask(validation.data, false);
		const task = await core.filesystem.loadTask(taskId);
		return Response.json(createSuccessResponse(task), { status: 201 });
	} catch (error) {
		return Response.json(
			createErrorResponse(
				API_ERROR_CODES.INTERNAL_ERROR,
				`Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
			{ status: 500 },
		);
	}
}

async function handleGetTask(
	core: Core,
	req: Request & { params: { id: string } },
) {
	const taskId = req.params.id;
	const task = await core.filesystem.loadTask(taskId);
	if (!task) {
		return Response.json(
			createErrorResponse(
				API_ERROR_CODES.TASK_NOT_FOUND,
				`Task with ID ${taskId} not found`,
			),
			{ status: 404 },
		);
	}
	return Response.json(createSuccessResponse(task));
}

async function handleUpdateTask(
	core: Core,
	req: Request & { params: { id: string } },
) {
	const taskId = req.params.id;
	try {
		const body = await req.json();
		const validation = validateRequestBody(UpdateTaskSchema, body);
		if (!validation.success) {
			return Response.json(validation.error, { status: 422 });
		}

		// Check if task exists first
		const existingTask = await core.filesystem.loadTask(taskId);
		if (!existingTask) {
			return Response.json(
				createErrorResponse(
					API_ERROR_CODES.TASK_NOT_FOUND,
					`Task with ID ${taskId} not found`,
				),
				{ status: 404 },
			);
		}

		// Merge the updates with existing task data
		const updatedTaskData = {
			...existingTask,
			...validation.data,
			id: taskId,
		};

		await core.updateTask(updatedTaskData, false);
		const updatedTask = await core.filesystem.loadTask(taskId);
		return Response.json(createSuccessResponse(updatedTask));
	} catch (error) {
		return Response.json(
			createErrorResponse(
				API_ERROR_CODES.INTERNAL_ERROR,
				`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
			{ status: 500 },
		);
	}
}

async function handleDeleteTask(
	core: Core,
	req: Request & { params: { id: string } },
) {
	const taskId = req.params.id;
	try {
		const success = await core.archiveTask(taskId, false);
		if (!success) {
			return Response.json(
				createErrorResponse(
					API_ERROR_CODES.TASK_NOT_FOUND,
					`Task with ID ${taskId} not found or already archived`,
				),
				{ status: 404 },
			);
		}
		return Response.json(createSuccessResponse({ taskId, archived: true }));
	} catch (error) {
		return Response.json(
			createErrorResponse(
				API_ERROR_CODES.INTERNAL_ERROR,
				`Failed to archive task: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
			{ status: 500 },
		);
	}
}

async function handleGetBoard(core: Core) {
	const tasks = await core.filesystem.listTasks();
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses || ["To Do", "In Progress", "Done"];
	return Response.json(createSuccessResponse({ tasks, statuses }));
}

async function handleGetDrafts(core: Core) {
	const drafts = await core.filesystem.listDrafts();
	return Response.json(createSuccessResponse(drafts));
}

async function handlePromoteDraft(
	core: Core,
	req: Request & { params: { id: string } },
) {
	const draftId = req.params.id;
	try {
		const success = await core.promoteDraft(draftId, false);
		if (!success) {
			return Response.json(
				createErrorResponse(
					API_ERROR_CODES.DRAFT_NOT_FOUND,
					`Draft with ID ${draftId} not found`,
				),
				{ status: 404 },
			);
		}

		// Get the promoted task
		const promotedTask = await core.filesystem.loadTask(draftId);
		return Response.json(createSuccessResponse(promotedTask));
	} catch (error) {
		return Response.json(
			createErrorResponse(
				API_ERROR_CODES.PROMOTION_FAILED,
				`Failed to promote draft: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
			{ status: 500 },
		);
	}
}

async function handleGetConfig(core: Core) {
	const config = await core.filesystem.loadConfig();
	return Response.json(createSuccessResponse(config));
}

async function handleUpdateConfig(core: Core, req: Request) {
	try {
		const body = await req.json();
		const validation = validateRequestBody(ConfigSchema, body);
		if (!validation.success) {
			return Response.json(validation.error, { status: 422 });
		}

		await core.filesystem.saveConfig(validation.data);
		return Response.json(createSuccessResponse(validation.data));
	} catch (error) {
		return Response.json(
			createErrorResponse(
				API_ERROR_CODES.INTERNAL_ERROR,
				`Failed to save configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
			{ status: 500 },
		);
	}
}

export class BacklogServer {
	private readonly core: Core;
	private server: any = null;
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

	async start(): Promise<ServerInfo> {
		let selectedPort = this.config.port;
		let portRetries = 0;
		const core = this.core; // Capture core instance for use in routes

		// Try to find an available port
		while (portRetries < this.config.maxPortRetries) {
			try {
				// Use Bun's fullstack serve with routes object
				this.server = serve({
					port: selectedPort,
					hostname: this.config.host,
					development: this.config.development,
					routes: {
						// Main HTML page - Bun will bundle all assets automatically
						"/": indexHtml,

						// Health check endpoint
						"/health": {
							GET: handleHealthCheck,
						},

						// Tasks API endpoints
						"/api/tasks": {
							GET: (req: Request) => handleGetTasks(core, req),
							POST: (req: Request) => handleCreateTask(core, req),
						},

						// Single task operations
						"/api/tasks/:id": {
							GET: (req: Request) =>
								handleGetTask(
									core,
									req as Request & { params: { id: string } },
								),
							PUT: (req: Request) =>
								handleUpdateTask(
									core,
									req as Request & { params: { id: string } },
								),
							DELETE: (req: Request) =>
								handleDeleteTask(
									core,
									req as Request & { params: { id: string } },
								),
						},

						// Board endpoint
						"/api/board": {
							GET: () => handleGetBoard(core),
						},

						// Drafts endpoint
						"/api/drafts": {
							GET: () => handleGetDrafts(core),
						},

						// Draft promotion endpoint
						"/api/drafts/:id/promote": {
							POST: (req: Request) =>
								handlePromoteDraft(
									core,
									req as Request & { params: { id: string } },
								),
						},

						// Configuration endpoint
						"/api/config": {
							GET: () => handleGetConfig(core),
							PUT: (req: Request) => handleUpdateConfig(core, req),
						},
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
			} catch (_error) {
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
}
