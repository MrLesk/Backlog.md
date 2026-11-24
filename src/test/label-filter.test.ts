import { describe, expect, test } from "bun:test";
import type { Task } from "../types/index.ts";
import { collectAvailableLabels } from "../utils/label-filter.ts";

const taskWithLabels = (labels: string[]): Task => ({
	id: "task-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels,
	dependencies: [],
	createdDate: "2026-01-01",
});

describe("collectAvailableLabels", () => {
	test("lists configured and task labels once each, alphabetically, in the spelling seen first", () => {
		const tasks = [taskWithLabels(["beta", "zeta"]), taskWithLabels(["delta", "ALPHA"])];

		expect(collectAvailableLabels(tasks, ["zeta", "Alpha"])).toEqual(["Alpha", "beta", "delta", "zeta"]);
	});
});
