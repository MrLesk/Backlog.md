import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Global config (single-instance app: no projects table)
export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(), // JSON for arrays, plain string for scalars
});

// Tasks
export const tasks = sqliteTable("tasks", {
	id: text("id").primaryKey(), // "task-1"
	title: text("title").notNull(),
	status: text("status").notNull().default("To Do"),
	priority: text("priority"), // "high" | "medium" | "low"
	assignee: text("assignee").notNull().default("[]"), // JSON: ["@user"]
	reporter: text("reporter"),
	labels: text("labels").notNull().default("[]"), // JSON: ["bug","feature"]
	milestone: text("milestone"),
	dependencies: text("dependencies").notNull().default("[]"), // JSON: ["task-2"]
	parentTaskId: text("parent_task_id"),
	subtasks: text("subtasks").notNull().default("[]"), // JSON: ["task-5"]
	description: text("description"), // Markdown
	implementationPlan: text("implementation_plan"),
	implementationNotes: text("implementation_notes"),
	ordinal: integer("ordinal").default(0),
	isDraft: integer("is_draft", { mode: "boolean" }).default(false),
	isArchived: integer("is_archived", { mode: "boolean" }).default(false),
	isCompleted: integer("is_completed", { mode: "boolean" }).default(false),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at"),
});

// Acceptance criteria (separate table for easy querying)
export const acceptanceCriteria = sqliteTable("acceptance_criteria", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	taskId: text("task_id")
		.notNull()
		.references(() => tasks.id, { onDelete: "cascade" }),
	index: integer("index").notNull(),
	text: text("text").notNull(),
	checked: integer("checked", { mode: "boolean" }).default(false),
});

// Documents
export const documents = sqliteTable("documents", {
	id: text("id").primaryKey(), // "doc-1"
	title: text("title").notNull(),
	content: text("content").notNull().default(""), // Markdown
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at"),
});

// Architectural Decision Records
export const decisions = sqliteTable("decisions", {
	id: text("id").primaryKey(), // "decision-1"
	title: text("title").notNull(),
	status: text("status"), // "Accepted" | "Deprecated" | "Superseded"
	content: text("content").notNull().default(""), // Markdown
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at"),
});

// Types for select queries
export type Task = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type AcceptanceCriterion = typeof acceptanceCriteria.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;
export type Decision = typeof decisions.$inferSelect;
export type DecisionInsert = typeof decisions.$inferInsert;
