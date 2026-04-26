import { describe, expect, it } from "bun:test";
import { parseSearchCommandQuery } from "../web/utils/search-command-query.ts";

describe("parseSearchCommandQuery", () => {
	it("parses task filters and keeps remaining words as the text query", () => {
		expect(parseSearchCommandQuery("status:Done priority:high label:bug assignee:@alex fix login")).toEqual({
			query: "fix login",
			status: "Done",
			priority: "high",
			labels: ["bug"],
			assignee: "@alex",
		});
	});

	it("supports quoted values with spaces", () => {
		expect(parseSearchCommandQuery('status:"In Progress" label:"customer bug" fix login')).toEqual({
			query: "fix login",
			status: "In Progress",
			labels: ["customer bug"],
		});
	});

	it("collects repeated labels and label aliases", () => {
		expect(parseSearchCommandQuery("label:bug labels:frontend labels:regression layout")).toEqual({
			query: "layout",
			labels: ["bug", "frontend", "regression"],
		});
	});

	it("supports type and modified file aliases", () => {
		expect(
			parseSearchCommandQuery(
				"type:task types:document modifiedFile:src/web/App.tsx modifiedFiles:src/core/search.ts nav",
			),
		).toEqual({
			query: "nav",
			types: ["task", "document"],
			modifiedFiles: ["src/web/App.tsx", "src/core/search.ts"],
		});
	});

	it("keeps unknown fields in the text query", () => {
		expect(parseSearchCommandQuery("project:web status:Done fix login")).toEqual({
			query: "project:web fix login",
			status: "Done",
		});
	});

	it("keeps malformed and unsupported tokens in the text query", () => {
		expect(parseSearchCommandQuery('status: priority:urgent type:note status:"In Progress fix')).toEqual({
			query: 'status: priority:urgent type:note status:"In Progress fix',
		});
	});

	it("returns an empty query when all tokens are filters", () => {
		expect(parseSearchCommandQuery("status:Done labels:bug")).toEqual({
			query: "",
			status: "Done",
			labels: ["bug"],
		});
	});
});
