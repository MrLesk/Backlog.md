import type { ZodSchema } from "zod";
import {
	API_ERROR_CODES,
	type ErrorResponse,
	type SuccessResponse,
	type Task,
	type TaskQueryParams,
} from "./schemas.ts";

export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
	return {
		success: true,
		data,
	};
}

export function createErrorResponse(
	code: string,
	message: string,
	details?: any,
): ErrorResponse {
	return {
		success: false,
		error: {
			code,
			message,
			details,
		},
	};
}

export function createJsonResponse<T>(
	data: SuccessResponse<T> | ErrorResponse,
	status = 200,
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export function validateRequestBody<T>(
	schema: ZodSchema<T>,
	body: any,
): { success: true; data: T } | { success: false; error: ErrorResponse } {
	try {
		const validatedData = schema.parse(body);
		return { success: true, data: validatedData };
	} catch (error: any) {
		const errorMessage =
			error.errors
				?.map((err: any) => `${err.path.join(".")}: ${err.message}`)
				.join(", ") || "Invalid input";
		return {
			success: false,
			error: createErrorResponse(
				API_ERROR_CODES.VALIDATION_ERROR,
				errorMessage,
				error.errors,
			),
		};
	}
}

export function parseQueryParams(url: URL): TaskQueryParams {
	const params: TaskQueryParams = {};

	if (url.searchParams.has("status")) {
		params.status = url.searchParams.get("status")!;
	}

	if (url.searchParams.has("assignee")) {
		params.assignee = url.searchParams.get("assignee")!;
	}

	if (url.searchParams.has("labels")) {
		params.labels = url.searchParams.get("labels")!;
	}

	if (url.searchParams.has("priority")) {
		const priority = url.searchParams.get("priority");
		if (priority === "high" || priority === "medium" || priority === "low") {
			params.priority = priority;
		}
	}

	if (url.searchParams.has("milestone")) {
		params.milestone = url.searchParams.get("milestone")!;
	}

	if (url.searchParams.has("parentTaskId")) {
		params.parentTaskId = url.searchParams.get("parentTaskId")!;
	}

	return params;
}

export function filterTasks(tasks: Task[], filters: TaskQueryParams): Task[] {
	return tasks.filter((task) => {
		// Filter by status
		if (filters.status && task.status !== filters.status) {
			return false;
		}

		// Filter by assignee
		if (filters.assignee) {
			const hasAssignee = task.assignee.some((assignee) =>
				assignee.toLowerCase().includes(filters.assignee!.toLowerCase()),
			);
			if (!hasAssignee) {
				return false;
			}
		}

		// Filter by labels (comma-separated list)
		if (filters.labels) {
			const filterLabels = filters.labels
				.split(",")
				.map((label) => label.trim().toLowerCase());
			const hasAnyLabel = filterLabels.some((filterLabel) =>
				task.labels.some((taskLabel) =>
					taskLabel.toLowerCase().includes(filterLabel),
				),
			);
			if (!hasAnyLabel) {
				return false;
			}
		}

		// Filter by priority
		if (filters.priority && task.priority !== filters.priority) {
			return false;
		}

		// Filter by milestone
		if (filters.milestone && task.milestone !== filters.milestone) {
			return false;
		}

		// Filter by parent task ID
		if (filters.parentTaskId && task.parentTaskId !== filters.parentTaskId) {
			return false;
		}

		return true;
	});
}
