import { describe, expect, it } from "bun:test";
import { buildTaskUpdateInput, isSchemaPlaceholder } from "../utils/task-edit-builder.ts";

describe("isSchemaPlaceholder", () => {
	it("identifies TypeScript schema placeholder echoes", () => {
		// Question mark suffixes
		expect(isSchemaPlaceholder("planSet?")).toBe(true);
		expect(isSchemaPlaceholder("notesSet?")).toBe(true);
		expect(isSchemaPlaceholder("description?")).toBe(true);
		expect(isSchemaPlaceholder("status?")).toBe(true);
		expect(isSchemaPlaceholder("title?")).toBe(true);
		expect(isSchemaPlaceholder("dueDate?")).toBe(true);
		expect(isSchemaPlaceholder("priority?")).toBe(true);
		expect(isSchemaPlaceholder("type?")).toBe(true);

		// Array question mark suffixes
		expect(isSchemaPlaceholder("acceptanceCriteriaSet?[]")).toBe(true);
		expect(isSchemaPlaceholder("commentsAppend?[]")).toBe(true);
		expect(isSchemaPlaceholder("labels?[]")).toBe(true);
		expect(isSchemaPlaceholder("planAppend?[]")).toBe(true);
		expect(isSchemaPlaceholder("notesAppend?[]")).toBe(true);
		expect(isSchemaPlaceholder("assignee?[]")).toBe(true);
		expect(isSchemaPlaceholder("dependencies?[]")).toBe(true);

		// Optional property with colon and types
		expect(isSchemaPlaceholder("commentAuthor?:")).toBe(true);
		expect(isSchemaPlaceholder("commentAuthor?: string")).toBe(true);
		expect(isSchemaPlaceholder("planSet?: string")).toBe(true);
		expect(isSchemaPlaceholder("finalSummaryClear?: boolean")).toBe(true);
		expect(isSchemaPlaceholder("ordinal?: number")).toBe(true);
		expect(isSchemaPlaceholder("acceptanceCriteriaSet?: string[]")).toBe(true);
		expect(isSchemaPlaceholder("commentsAppend?[]: string[]")).toBe(true);

		// Explicit type signatures
		expect(isSchemaPlaceholder("id: string")).toBe(true);
		expect(isSchemaPlaceholder("title: string")).toBe(true);
		expect(isSchemaPlaceholder("ordinal: number")).toBe(true);
		expect(isSchemaPlaceholder("planAppend: string[]")).toBe(true);
	});

	it("does not flag legitimate user comments or queries", () => {
		expect(isSchemaPlaceholder("Why?")).toBe(false);
		expect(isSchemaPlaceholder("Done?")).toBe(false);
		expect(isSchemaPlaceholder("Ready?")).toBe(false);
		expect(isSchemaPlaceholder("Fixed?")).toBe(false);
		expect(isSchemaPlaceholder("LGTM!")).toBe(false);
		expect(isSchemaPlaceholder("Can we check planSet before merging?")).toBe(false);
		expect(isSchemaPlaceholder("Review approved - ready for QA.")).toBe(false);
		expect(isSchemaPlaceholder("Note: this is important.")).toBe(false);
		expect(isSchemaPlaceholder("")).toBe(false);
	});
});

describe("buildTaskUpdateInput", () => {
	it("filters schema placeholders from commentsAppend and commentAuthor", () => {
		const result = buildTaskUpdateInput({
			commentsAppend: [
				"planSet?: string",
				"acceptanceCriteriaSet?[]",
				"commentAuthor?:",
				"commentAuthor?: string",
				"Actual review comment",
			],
			commentAuthor: "commentAuthor?:",
		});

		expect(result.appendComments).toEqual([{ body: "Actual review comment" }]);
	});

	it("ignores comment-only update if only placeholders were provided", () => {
		const result = buildTaskUpdateInput({
			commentsAppend: ["planSet?: string", "acceptanceCriteriaSet?[]"],
		});

		expect(result.appendComments).toBeUndefined();
	});

	it("ignores placeholder string and array fields", () => {
		const result = buildTaskUpdateInput({
			title: "title?",
			description: "description?",
			status: "status?",
			priority: "priority?",
			type: "type?",
			project: "project?",
			milestone: "milestone?",
			planSet: "planSet?",
			notesSet: "notesSet?",
			finalSummary: "finalSummary?",
			assignee: ["assignee?[]"],
			dependencies: ["dependencies?[]"],
			references: ["references?[]"],
			documentation: ["documentation?[]"],
			modifiedFiles: ["modifiedFiles?[]"],
			commentsAppend: ["Clean comment"],
			commentAuthor: "@reviewer",
		});

		expect(result.title).toBeUndefined();
		expect(result.description).toBeUndefined();
		expect(result.status).toBeUndefined();
		expect(result.priority).toBeUndefined();
		expect(result.type).toBeUndefined();
		expect(result.project).toBeUndefined();
		expect(result.milestone).toBeUndefined();
		expect(result.implementationPlan).toBeUndefined();
		expect(result.implementationNotes).toBeUndefined();
		expect(result.finalSummary).toBeUndefined();
		expect(result.assignee).toBeUndefined();
		expect(result.dependencies).toBeUndefined();
		expect(result.references).toBeUndefined();
		expect(result.documentation).toBeUndefined();
		expect(result.modifiedFiles).toBeUndefined();
		expect(result.appendComments).toEqual([{ body: "Clean comment", author: "@reviewer" }]);
	});

	it("preserves explicit empty clear operations for clearable lists", () => {
		const result = buildTaskUpdateInput({
			assignee: [],
			dependencies: [],
			references: [],
			documentation: [],
			modifiedFiles: [],
			labels: [],
			dueDate: null,
			milestone: null,
			planClear: true,
			notesClear: true,
			finalSummaryClear: true,
		});

		expect(result.assignee).toEqual([]);
		expect(result.dependencies).toEqual([]);
		expect(result.references).toEqual([]);
		expect(result.documentation).toEqual([]);
		expect(result.modifiedFiles).toEqual([]);
		expect(result.labels).toEqual([]);
		expect(result.dueDate).toBeNull();
		expect(result.milestone).toBeNull();
		expect(result.clearImplementationPlan).toBe(true);
		expect(result.clearImplementationNotes).toBe(true);
		expect(result.clearFinalSummary).toBe(true);
	});

	it("preserves legitimate property-shaped comment bodies", () => {
		const result = buildTaskUpdateInput({ commentsAppend: ["status?", "title?"] });
		expect(result.appendComments?.map((comment) => (typeof comment === "string" ? comment : comment.body))).toEqual([
			"status?",
			"title?",
		]);
	});

	it("omits a placeholder-only comment payload", () => {
		const result = buildTaskUpdateInput({ commentsAppend: ["planSet?: string", "commentAuthor?: string"] });
		expect(result.appendComments).toBeUndefined();
	});

	it("filters combined array/type schema echoes while preserving exact property comments", () => {
		const result = buildTaskUpdateInput({
			commentsAppend: ["commentsAppend?[]: string[]", "commentsAppend?", "Actual comment"],
		});
		expect(result.appendComments).toEqual([{ body: "commentsAppend?" }, { body: "Actual comment" }]);
	});
});
