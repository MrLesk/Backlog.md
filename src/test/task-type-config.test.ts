import { describe, expect, it } from "bun:test";
import { DEFAULT_TASK_TYPES } from "../constants/index.ts";
import { formatValidTaskTypeValues, getTaskTypeValues, resolveTaskTypeValue } from "../utils/task-type-config.ts";

describe("task type configuration", () => {
	it("uses defaults when task types are not configured", () => {
		expect(getTaskTypeValues()).toEqual([...DEFAULT_TASK_TYPES]);
		expect(formatValidTaskTypeValues()).toBe(DEFAULT_TASK_TYPES.join(", "));
	});

	it("normalizes configured values while preserving canonical casing", () => {
		const config = { types: [" Bug ", "Epic", "bug", ""] };

		expect(getTaskTypeValues(config)).toEqual(["Bug", "Epic"]);
		expect(resolveTaskTypeValue(" ePiC ", config)).toBe("Epic");
		expect(resolveTaskTypeValue("feature", config)).toBeUndefined();
	});
});
