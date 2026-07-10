import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { resolveTaskById } from "../utils/task-id.ts";

const task = (id: string): Task => ({
	id,
	title: id,
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-07-10",
});

describe("resolveTaskById", () => {
	it("resolves configured prefixes, padding, and dotted subtasks from numeric routes", () => {
		const result = resolveTaskById([task("BACK-001.02")], "1.2");
		expect(result.status).toBe("found");
		if (result.status === "found") {
			expect(result.task.id).toBe("BACK-001.02");
		}
	});

	it("uses an explicit custom prefix to disambiguate matching numbers", () => {
		const tasks = [task("BACK-7"), task("JIRA-7")];
		const result = resolveTaskById(tasks, "jira-007");
		expect(result.status).toBe("found");
		if (result.status === "found") {
			expect(result.task.id).toBe("JIRA-7");
		}
	});

	it("fails closed when numeric or padded identities are ambiguous", () => {
		expect(resolveTaskById([task("BACK-7"), task("JIRA-7")], "7").status).toBe("ambiguous");
		expect(resolveTaskById([task("BACK-1.2"), task("BACK-001.02")], "BACK-1.2").status).toBe("ambiguous");
	});

	it("distinguishes invalid and missing route IDs", () => {
		expect(resolveTaskById([task("BACK-1")], "BACK-1/2").status).toBe("invalid");
		expect(resolveTaskById([task("BACK-1")], "../1").status).toBe("invalid");
		expect(resolveTaskById([task("BACK-1")], "2").status).toBe("not-found");
	});
});
