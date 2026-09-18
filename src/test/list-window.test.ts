import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";
import {
	addListWindowOptions,
	formatListWindowFooter,
	type ListPage,
	type ListWindow,
	milestoneSectionsInWindow,
	nextPageCommand,
	parseListWindow,
	selectListWindow,
} from "../utils/list-window.ts";

/** `backlog task list` with the window options and one option that reads a value, `--search`. */
function taskListCommand(): Command {
	return addListWindowOptions(new Command("backlog").command("task").command("list").option("--search <query>"));
}

function windowOf(skip: number, maxCount?: number, commandArgs: string[] = []): ListWindow {
	const window = parseListWindow(
		{ skip: String(skip), maxCount: maxCount === undefined ? undefined : String(maxCount) },
		taskListCommand(),
		commandArgs,
	);
	if (!window) throw new Error("invalid test window");
	return window;
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
		const footer = (skip: number, maxCount: number) => {
			const window = windowOf(skip, maxCount, args);
			return formatListWindowFooter(selectListWindow(items, window), window);
		};

		expect(footer(0, 5)).toBeNull();
		expect(footer(2, 2)).toBe("Showing 3-4 of 5 items. Next: backlog task list --max-count 2 --plain --skip 4");
		expect(footer(4, 2)).toBe("Showing 5-5 of 5 items.");
		expect(footer(9, 2)).toBe("Showing 0 of 5 items.");
	});

	it("replaces the typed skip and quotes arguments the shell would split", () => {
		expect(nextPageCommand(windowOf(0, 3, ["task", "list", "--skip", "3", "--max-count", "3"]), 6)).toBe(
			"backlog task list --max-count 3 --skip 6",
		);
		expect(
			nextPageCommand(
				windowOf(0, 3, ["search", "--skip=3", "it's done", "--status", "To Do", "=draft", "--priority=high"]),
				6,
			),
		).toBe("backlog search 'it'\\''s done' --status 'To Do' '=draft' '--priority=high' --skip 6");
	});

	it("keeps option values that read --skip or -- and puts the new skip before --", () => {
		const next = (args: string[]) => nextPageCommand(windowOf(0, 1, args), 1);

		expect(next(["task", "list", "--search", "--skip", "--max-count", "1"])).toBe(
			"backlog task list --search --skip --max-count 1 --skip 1",
		);
		expect(next(["task", "list", "--search", "--skip", "--skip", "3", "--max-count", "1"])).toBe(
			"backlog task list --search --skip --max-count 1 --skip 1",
		);
		expect(next(["task", "list", "--search", "--", "--max-count", "1"])).toBe(
			"backlog task list --search -- --max-count 1 --skip 1",
		);
		expect(next(["doc", "list", "--max-count", "1", "--"])).toBe("backlog doc list --max-count 1 --skip 1 --");
		expect(next(["search", "--max-count", "1", "--", "--skip", "it"])).toBe(
			"backlog search --max-count 1 --skip 1 -- --skip it",
		);
	});

	it("accepts a positive max-count, a non-negative skip, and count without JSON", () => {
		const args = ["task", "list"];
		expect(parseListWindow({}, taskListCommand(), args)).toMatchObject({
			skip: 0,
			maxCount: undefined,
			count: false,
			forcesText: false,
			commandArgs: args,
		});
		expect(parseListWindow({ maxCount: "5", skip: "0" }, taskListCommand(), args)).toMatchObject({
			skip: 0,
			maxCount: 5,
			count: false,
			forcesText: true,
		});
		expect(parseListWindow({ count: true }, taskListCommand(), args)).toMatchObject({
			count: true,
			forcesText: true,
		});
	});

	it("prints each milestone section once, where it falls", () => {
		const active = { isCompleted: false };
		const completed = { isCompleted: true };
		const sections = (items: { isCompleted: boolean }[], skip: number, maxCount: number, listsCompleted: boolean) => {
			const activeCount = items.filter((item) => !item.isCompleted).length;
			return milestoneSectionsInWindow(selectListWindow(items, windowOf(skip, maxCount)), activeCount, listsCompleted);
		};

		// Two active and one listed completed milestone, one per window.
		const listed = [active, active, completed];
		expect(sections(listed, 0, 1, true)).toEqual({ active: true, completed: false });
		expect(sections(listed, 1, 1, true)).toEqual({ active: true, completed: false });
		expect(sections(listed, 2, 1, true)).toEqual({ active: false, completed: true });
		// Completed milestones collapsed: their section follows the last active milestone.
		expect(sections([active, active], 0, 1, false)).toEqual({ active: true, completed: false });
		expect(sections([active, active], 1, 1, false)).toEqual({ active: true, completed: true });
		// No active milestones: the empty Active section opens the first window only.
		expect(sections([completed, completed], 0, 1, true)).toEqual({ active: true, completed: true });
		expect(sections([completed, completed], 1, 1, true)).toEqual({ active: false, completed: true });
		// No milestones at all: the single window prints both empty sections, whatever it skips.
		expect(sections([], 3, 1, false)).toEqual({ active: true, completed: true });
	});

	it("rejects invalid window values and count with JSON", () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const previousExitCode = process.exitCode;
		try {
			for (const options of [{ maxCount: "0" }, { maxCount: "2.5" }, { skip: "-1" }, { skip: "x" }]) {
				process.exitCode = 0;
				expect(parseListWindow(options, taskListCommand(), [])).toBeNull();
				expect(process.exitCode).toBe(1);
			}
			expect(parseListWindow({ count: true, json: true }, taskListCommand(), [])).toBeNull();
			expect(errors).toHaveBeenLastCalledWith(
				"--count cannot be combined with --json. Try 'backlog task list --help' for options.",
			);
		} finally {
			errors.mockRestore();
			process.exitCode = previousExitCode;
		}
	});
});
