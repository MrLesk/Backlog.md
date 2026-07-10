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

	it("resolves safe legacy IDs by exact identity only", () => {
		const result = resolveTaskById([task("TASK-PREFIXED"), task("TASK-PREFIXED-EXTRA")], "task-prefixed");
		expect(result.status).toBe("found");
		if (result.status === "found") {
			expect(result.task.id).toBe("TASK-PREFIXED");
		}
		expect(resolveTaskById([task("TASK-PREFIXED")], "TASK-PREFIXED-EXTRA").status).toBe("not-found");
	});

	it("fails closed on duplicate exact legacy identities", () => {
		expect(resolveTaskById([task("TASK-PREFIXED"), task("task-prefixed")], "TASK-PREFIXED").status).toBe("ambiguous");
	});

	it("compares arbitrarily large decimal segments without number coercion", () => {
		const adjacent = resolveTaskById([task("TASK-9007199254740993")], "TASK-9007199254740992");
		expect(adjacent.status).toBe("not-found");

		const padded = resolveTaskById([task("TASK-9007199254740992.0002")], "task-09007199254740992.2");
		expect(padded.status).toBe("found");
		if (padded.status === "found") {
			expect(padded.task.id).toBe("TASK-9007199254740992.0002");
		}

		const zero = resolveTaskById([task("TASK-0000.00")], "0.0");
		expect(zero.status).toBe("found");
	});

	it("fails closed when numeric or padded identities are ambiguous", () => {
		expect(resolveTaskById([task("BACK-7"), task("JIRA-7")], "7").status).toBe("ambiguous");
		expect(resolveTaskById([task("BACK-1.2"), task("BACK-001.02")], "BACK-1.2").status).toBe("ambiguous");
		expect(
			resolveTaskById([task("TASK-9007199254740992.2"), task("TASK-09007199254740992.0002")], "TASK-9007199254740992.2")
				.status,
		).toBe("ambiguous");
	});

	it("distinguishes invalid and missing route IDs", () => {
		expect(resolveTaskById([task("BACK-1")], "BACK-1/2").status).toBe("invalid");
		expect(resolveTaskById([task("BACK-1")], "../1").status).toBe("invalid");
		expect(resolveTaskById([task("TASK-PREFIXED")], "TASK-..").status).toBe("invalid");
		expect(resolveTaskById([task("TASK-PREFIXED")], "TASK-PREFIXED\\..\\secret").status).toBe("invalid");
		expect(resolveTaskById([task("TASK-PREFIXED")], "TASK-PREFIXED%2F..%2Fsecret").status).toBe("invalid");
		expect(resolveTaskById([task("BACK-1")], "2").status).toBe("not-found");
		expect(resolveTaskById([task("TASK-PREFIXED")], "TASK-MISSING").status).toBe("not-found");
	});
});
