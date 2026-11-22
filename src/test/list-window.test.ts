import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";
import { addListWindowOptions, type ListWindow, nextPageCommand, parseListWindow } from "../utils/list-window.ts";

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
