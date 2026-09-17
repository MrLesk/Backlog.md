import { describe, expect, it, spyOn } from "bun:test";
import {
	formatListWindowFooter,
	type ListPage,
	type ListWindow,
	nextPageCommand,
	parseListWindow,
	selectListWindow,
} from "../utils/list-window.ts";

function windowOf(skip: number, maxCount?: number): ListWindow {
	return { skip, maxCount, count: false, forcesText: true, commandArgs: [] };
}

describe("list windows", () => {
	it("covers every item exactly once when following nextSkip", () => {
		for (const size of [0, 1, 5, 6, 7]) {
			const items = Array.from({ length: size }, (_, index) => index);
			for (const maxCount of [1, 2, 3, 10]) {
				const seen: number[] = [];
				let skip: number | null = 0;
				while (skip !== null) {
					const page: ListPage<number> = selectListWindow(items, windowOf(skip, maxCount));
					seen.push(...page.items);
					skip = page.nextSkip;
				}
				expect(seen).toEqual(items);
			}
		}
	});

	it("marks only windows that leave items out as cut", () => {
		const items = ["a", "b", "c"];

		expect(selectListWindow(items, windowOf(0))).toMatchObject({ items, cut: false, nextSkip: null });
		expect(selectListWindow(items, windowOf(0, 3))).toMatchObject({ items, cut: false, nextSkip: null });
		expect(selectListWindow([], windowOf(4, 2))).toMatchObject({ items: [], total: 0, cut: false, nextSkip: null });
		expect(selectListWindow(items, windowOf(0, 2))).toMatchObject({ items: ["a", "b"], cut: true, nextSkip: 2 });
		expect(selectListWindow(items, windowOf(2, 2))).toMatchObject({ items: ["c"], cut: true, nextSkip: null });
		expect(selectListWindow(items, windowOf(1))).toMatchObject({ items: ["b", "c"], cut: true, nextSkip: null });
		expect(selectListWindow(items, windowOf(3, 2))).toMatchObject({ items: [], total: 3, cut: true, nextSkip: null });
	});

	it("prints a footer only for cut output and names the next command while items follow", () => {
		const items = ["a", "b", "c", "d", "e"];
		const args = ["task", "list", "--max-count", "2", "--plain"];

		expect(formatListWindowFooter(selectListWindow(items, windowOf(0, 5)), args)).toBeNull();
		expect(formatListWindowFooter(selectListWindow(items, windowOf(2, 2)), args)).toBe(
			"Showing 3-4 of 5 items. Next: backlog task list --max-count 2 --plain --skip 4",
		);
		expect(formatListWindowFooter(selectListWindow(items, windowOf(4, 2)), args)).toBe("Showing 5-5 of 5 items.");
		expect(formatListWindowFooter(selectListWindow(items, windowOf(9, 2)), args)).toBe("Showing 0 of 5 items.");
	});

	it("replaces the typed skip and quotes arguments the shell would split", () => {
		expect(nextPageCommand(["task", "list", "--skip", "3", "--max-count", "3"], 6)).toBe(
			"backlog task list --max-count 3 --skip 6",
		);
		expect(
			nextPageCommand(["search", "--skip=3", "it's done", "--status", "To Do", "=draft", "--priority=high"], 6),
		).toBe("backlog search 'it'\\''s done' --status 'To Do' '=draft' '--priority=high' --skip 6");
	});

	it("accepts a positive max-count, a non-negative skip, and count without JSON", () => {
		const args = ["task", "list"];
		expect(parseListWindow({}, "backlog task list --help", args)).toEqual({
			skip: 0,
			maxCount: undefined,
			count: false,
			forcesText: false,
			commandArgs: args,
		});
		expect(parseListWindow({ maxCount: "5", skip: "0" }, "backlog task list --help", args)).toMatchObject({
			skip: 0,
			maxCount: 5,
			count: false,
			forcesText: true,
		});
		expect(parseListWindow({ count: true }, "backlog task list --help", args)).toMatchObject({
			count: true,
			forcesText: true,
		});
	});

	it("rejects invalid window values and count with JSON", () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const previousExitCode = process.exitCode;
		try {
			for (const options of [{ maxCount: "0" }, { maxCount: "2.5" }, { skip: "-1" }, { skip: "x" }]) {
				process.exitCode = 0;
				expect(parseListWindow(options, "backlog task list --help", [])).toBeNull();
				expect(process.exitCode).toBe(1);
			}
			expect(parseListWindow({ count: true, json: true }, "backlog task list --help", [])).toBeNull();
			expect(errors).toHaveBeenLastCalledWith(
				"--count cannot be combined with --json. Try 'backlog task list --help' for options.",
			);
		} finally {
			errors.mockRestore();
			process.exitCode = previousExitCode;
		}
	});
});
