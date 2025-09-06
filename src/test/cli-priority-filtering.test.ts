import { describe, expect, test } from "bun:test";
import { $ } from "bun";

describe("CLI Priority Filtering", () => {
	test("task list --priority high shows only high priority tasks", async () => {
		const result = await $`bun run cli task list --priority high --plain`.quiet();
		expect(result.exitCode).toBe(0);

		// Should only show high priority tasks
		const output = result.stdout.toString();
		if (output.includes("task-")) {
			// If tasks exist, check they have HIGH priority indicators
			expect(output).toMatch(/\[HIGH\]/);
			// Should not contain other priority indicators
			expect(output).not.toMatch(/\[MEDIUM\]/);
			expect(output).not.toMatch(/\[LOW\]/);
		}
	});

	test("task list --priority medium shows only medium priority tasks", async () => {
		const result = await $`bun run cli task list --priority medium --plain`.quiet();
		expect(result.exitCode).toBe(0);

		const output = result.stdout.toString();
		if (output.includes("task-")) {
			expect(output).toMatch(/\[MEDIUM\]/);
			expect(output).not.toMatch(/\[HIGH\]/);
			expect(output).not.toMatch(/\[LOW\]/);
		}
	});

	test("task list --priority low shows only low priority tasks", async () => {
		const result = await $`bun run cli task list --priority low --plain`.quiet();
		expect(result.exitCode).toBe(0);

		const output = result.stdout.toString();
		if (output.includes("task-")) {
			expect(output).toMatch(/\[LOW\]/);
			expect(output).not.toMatch(/\[HIGH\]/);
			expect(output).not.toMatch(/\[MEDIUM\]/);
		}
	});

	test("task list --priority invalid shows error", async () => {
		const result = await $`bun run cli task list --priority invalid --plain`.nothrow().quiet();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid priority: invalid");
		expect(result.stderr.toString()).toContain("Valid values are: high, medium, low");
	});

	test("task list --sort priority sorts by priority", async () => {
		const result = await $`bun run cli task list --sort priority --plain`.quiet();
		expect(result.exitCode).toBe(0);

		const output = result.stdout.toString();
		// If tasks exist, high priority should come before medium, which comes before low
		if (output.includes("[HIGH]") && output.includes("[MEDIUM]")) {
			const highIndex = output.indexOf("[HIGH]");
			const mediumIndex = output.indexOf("[MEDIUM]");
			expect(highIndex).toBeLessThan(mediumIndex);
		}
		if (output.includes("[MEDIUM]") && output.includes("[LOW]")) {
			const mediumIndex = output.indexOf("[MEDIUM]");
			const lowIndex = output.indexOf("[LOW]");
			expect(mediumIndex).toBeLessThan(lowIndex);
		}
	});

	test("task list --sort id sorts by task ID", async () => {
		const result = await $`bun run cli task list --sort id --plain`.quiet();
		expect(result.exitCode).toBe(0);
		// Should exit successfully - detailed sorting verification would require known test data
	});

	test("task list --sort invalid shows error", async () => {
		const result = await $`bun run cli task list --sort invalid --plain`.nothrow().quiet();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid sort field: invalid");
		expect(result.stderr.toString()).toContain("Valid values are: priority, id");
	});

	test("task list combines priority filter with status filter", async () => {
		const result = await $`bun run cli task list --priority high --status "To Do" --plain`.quiet();
		expect(result.exitCode).toBe(0);

		const output = result.stdout.toString();
		if (output.includes("task-")) {
			// Should only show high priority tasks in "To Do" status
			expect(output).toMatch(/\[HIGH\]/);
			expect(output).toMatch(/To Do:/);
		}
	});

	test("task list combines priority filter with sort", async () => {
		const result = await $`bun run cli task list --priority high --sort id --plain`.quiet();
		expect(result.exitCode).toBe(0);

		const output = result.stdout.toString();
		if (output.includes("[HIGH]")) {
			// Should only show high priority tasks, sorted by ID
			expect(output).toMatch(/\[HIGH\]/);
			expect(output).not.toMatch(/\[MEDIUM\]/);
			expect(output).not.toMatch(/\[LOW\]/);
		}
	});

	test("plain output includes priority indicators", async () => {
		const result = await $`bun run cli task list --plain`.quiet();
		expect(result.exitCode).toBe(0);

		const output = result.stdout.toString();
		// If any priority tasks exist, they should have proper indicators
		if (output.includes("task-")) {
			// Should have proper format with optional priority indicators
			expect(output).toMatch(/^\s*(\[HIGH\]|\[MEDIUM\]|\[LOW\])?\s*task-\d+\s+-\s+/m);
		}
	});

	test("case insensitive priority filtering", async () => {
		const upperResult = await $`bun run cli task list --priority HIGH --plain`.quiet();
		const lowerResult = await $`bun run cli task list --priority high --plain`.quiet();
		const mixedResult = await $`bun run cli task list --priority High --plain`.quiet();

		expect(upperResult.exitCode).toBe(0);
		expect(lowerResult.exitCode).toBe(0);
		expect(mixedResult.exitCode).toBe(0);

		const [upperOutput, lowerOutput, mixedOutput] = [
			upperResult.stdout.toString(),
			lowerResult.stdout.toString(),
			mixedResult.stdout.toString(),
		];
		const listUpper = upperOutput.split("\n").filter((line) => line.includes("task-"));
		const listLower = lowerOutput.split("\n").filter((line) => line.includes("task-"));
		const listMixed = mixedOutput.split("\n").filter((line) => line.includes("task-"));
		if (listLower.length > 0) {
			expect(listUpper).toEqual(listLower);
			expect(listMixed).toEqual(listLower);
		}

		for (const output of [upperOutput, lowerOutput, mixedOutput]) {
			if (output.includes("task-")) {
				expect(output).toMatch(/\[HIGH\]/);
				expect(output).not.toMatch(/\[MEDIUM\]/);
				expect(output).not.toMatch(/\[LOW\]/);
			}
		}
	});
});
