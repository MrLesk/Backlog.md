import type { BacklogConfig, Task } from "../../../types/index.ts";
import type { McpServer } from "../../server.ts";
import taskWidgetHtml from "./tasks-widget.html" with { type: "text" };

const TASKS_APP_URI = "ui://backlog/tasks.html";
const TASKS_APP_MIME_TYPE = "text/html;profile=mcp-app";
const STATUS_RANK: Record<string, number> = { "In Progress": 0, "To Do": 1, Done: 2 };

function progress(task: Task): { checked: number; total: number } {
	const criteria = task.acceptanceCriteriaItems ?? [];
	return {
		checked: criteria.filter((item) => item.checked).length,
		total: criteria.length,
	};
}

function sortTasks(tasks: Task[]): Task[] {
	return tasks.sort((left, right) => {
		const status = (STATUS_RANK[left.status] ?? 99) - (STATUS_RANK[right.status] ?? 99);
		if (status !== 0) return status;
		return (left.ordinal ?? Number.MAX_SAFE_INTEGER) - (right.ordinal ?? Number.MAX_SAFE_INTEGER);
	});
}

function taskSummary(task: Task) {
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority ?? null,
		assignees: task.assignee,
		type: task.type ?? null,
		progress: progress(task),
	};
}

function taskDetail(task: Task) {
	return {
		...taskSummary(task),
		description: task.description ?? "",
		labels: task.labels,
		milestone: task.milestone ?? null,
		createdDate: task.createdDate,
		updatedDate: task.updatedDate ?? null,
		acceptanceCriteria: task.acceptanceCriteriaItems ?? [],
		definitionOfDone: task.definitionOfDoneItems ?? [],
		implementationPlan: task.implementationPlan ?? "",
		implementationNotes: task.implementationNotes ?? "",
	};
}

function appMeta() {
	return {
		ui: { resourceUri: TASKS_APP_URI, visibility: ["model", "app"] },
		"openai/outputTemplate": TASKS_APP_URI,
		"openai/widgetAccessible": true,
	};
}

async function loadTasks(server: McpServer): Promise<Task[]> {
	return sortTasks(await server.queryTasks({ includeCrossBranch: false }));
}

function projectData(server: McpServer, config: BacklogConfig) {
	return { name: config.projectName, path: server.filesystem.rootDir };
}

export function registerTasksApp(server: McpServer, config: BacklogConfig): void {
	server.addResource({
		uri: TASKS_APP_URI,
		name: "Backlog tasks",
		description: "Interactive list and kanban views for Backlog.md tasks",
		mimeType: TASKS_APP_MIME_TYPE,
		handler: async () => ({
			contents: [{ uri: TASKS_APP_URI, mimeType: TASKS_APP_MIME_TYPE, text: taskWidgetHtml }],
		}),
	});

	server.addTool({
		name: "task_list_app",
		description:
			"Open the interactive Backlog.md task browser. Use this when the user asks to browse, view, filter, or inspect tasks visually.",
		inputSchema: { properties: {}, additionalProperties: false },
		annotations: {
			title: "Open Backlog Tasks",
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
		_meta: {
			...appMeta(),
			"openai/toolInvocation/invoking": "Loading tasks…",
			"openai/toolInvocation/invoked": "Tasks ready",
		},
		handler: async () => {
			const tasks = (await loadTasks(server)).map(taskSummary);

			return {
				content: [{ type: "text", text: `Loaded ${tasks.length} tasks for ${config.projectName}.` }],
				structuredContent: {
					view: "browse",
					project: projectData(server, config),
					statuses: config.statuses,
					tasks,
					selectedTaskId: null,
					selectedTask: null,
				},
			};
		},
	});

	server.addTool({
		name: "task_view_app",
		description:
			"Open one Backlog.md task in an interactive detail view. Use this when the user names a task ID or asks to use a task in chat.",
		inputSchema: {
			properties: { id: { type: "string", description: "Backlog task ID, for example BACK-574" } },
			required: ["id"],
			additionalProperties: false,
		},
		annotations: {
			title: "Open Backlog Task",
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
		_meta: {
			...appMeta(),
			"openai/toolInvocation/invoking": "Opening task…",
			"openai/toolInvocation/invoked": "Task ready",
		},
		handler: async (args) => {
			const requestedId = typeof args.id === "string" ? args.id.trim() : "";
			const tasks = await loadTasks(server);
			const selectedTask = tasks.find((task) => task.id.toLowerCase() === requestedId.toLowerCase());
			if (!selectedTask) {
				return {
					isError: true,
					content: [{ type: "text", text: `Task not found in the current project: ${requestedId || "(missing ID)"}` }],
				};
			}

			return {
				content: [{ type: "text", text: `Opened ${selectedTask.id}: ${selectedTask.title}.` }],
				structuredContent: {
					view: "detail",
					project: projectData(server, config),
					statuses: config.statuses,
					tasks: tasks.map(taskSummary),
					selectedTaskId: selectedTask.id,
					selectedTask: taskDetail(selectedTask),
				},
			};
		},
	});
}
