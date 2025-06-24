import { z } from "zod";

// Task schema matching the existing Task interface
export const TaskSchema = z.object({
	id: z.string(),
	title: z.string().min(1, "Title is required"),
	status: z.string(),
	assignee: z.array(z.string()).default([]),
	reporter: z.string().optional(),
	createdDate: z.string(),
	updatedDate: z.string().optional(),
	labels: z.array(z.string()).default([]),
	milestone: z.string().optional(),
	dependencies: z.array(z.string()).default([]),
	description: z.string(),
	acceptanceCriteria: z.array(z.string()).optional(),
	parentTaskId: z.string().optional(),
	subtasks: z.array(z.string()).optional(),
	priority: z.enum(["high", "medium", "low"]).optional(),
	branch: z.string().optional(),
});

// Schema for creating a new task (without id, dates)
export const CreateTaskSchema = z.object({
	title: z.string().min(1, "Title is required"),
	status: z.string().optional(),
	assignee: z.array(z.string()).default([]),
	reporter: z.string().optional(),
	labels: z.array(z.string()).default([]),
	milestone: z.string().optional(),
	dependencies: z.array(z.string()).default([]),
	description: z.string().default(""),
	acceptanceCriteria: z.array(z.string()).optional(),
	parentTaskId: z.string().optional(),
	priority: z.enum(["high", "medium", "low"]).optional(),
});

// Schema for updating a task (all fields optional except id)
export const UpdateTaskSchema = z.object({
	title: z.string().min(1, "Title is required").optional(),
	status: z.string().optional(),
	assignee: z.array(z.string()).optional(),
	reporter: z.string().optional(),
	labels: z.array(z.string()).optional(),
	milestone: z.string().optional(),
	dependencies: z.array(z.string()).optional(),
	description: z.string().optional(),
	acceptanceCriteria: z.array(z.string()).optional(),
	parentTaskId: z.string().optional(),
	priority: z.enum(["high", "medium", "low"]).optional(),
});

// Schema for query parameters when listing tasks
export const TaskQuerySchema = z.object({
	status: z.string().optional(),
	assignee: z.string().optional(),
	labels: z.string().optional(), // comma-separated string like "bug,feature"
	priority: z.enum(["high", "medium", "low"]).optional(),
	milestone: z.string().optional(),
	parentTaskId: z.string().optional(),
});

// Configuration schema
export const ConfigSchema = z.object({
	projectName: z.string(),
	defaultAssignee: z.string().optional(),
	defaultReporter: z.string().optional(),
	statuses: z.array(z.string()),
	labels: z.array(z.string()),
	milestones: z.array(z.string()),
	defaultStatus: z.string().optional(),
	dateFormat: z.string(),
	maxColumnWidth: z.number().optional(),
	taskResolutionStrategy: z.enum(["most_recent", "most_progressed"]).optional(),
});

// Standard API response schemas
export const SuccessResponseSchema = z.object({
	success: z.literal(true),
	data: z.any(),
});

export const ErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.any().optional(),
	}),
});

// Types derived from schemas
export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskData = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskData = z.infer<typeof UpdateTaskSchema>;
export type TaskQueryParams = z.infer<typeof TaskQuerySchema>;
export type ConfigData = z.infer<typeof ConfigSchema>;
export type SuccessResponse<T = any> = {
	success: true;
	data: T;
};
export type ErrorResponse = {
	success: false;
	error: {
		code: string;
		message: string;
		details?: any;
	};
};

// API Error codes
export const API_ERROR_CODES = {
	TASK_NOT_FOUND: "TASK_NOT_FOUND",
	INVALID_INPUT: "INVALID_INPUT",
	TASK_ALREADY_EXISTS: "TASK_ALREADY_EXISTS",
	CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	VALIDATION_ERROR: "VALIDATION_ERROR",
	DRAFT_NOT_FOUND: "DRAFT_NOT_FOUND",
	PROMOTION_FAILED: "PROMOTION_FAILED",
} as const;
