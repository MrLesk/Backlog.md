import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createOrderFixtureProject } from "./task-list-order-fixture.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = process.env.TUI_TEST_CLI_PATH?.trim() || getTestCliPath();
const CLI_RUNTIME = process.env.TUI_TEST_CLI_RUNTIME?.trim() ?? "bun";
const CLI_COMMAND = CLI_RUNTIME.length === 0 ? [CLI_PATH] : [CLI_RUNTIME, CLI_PATH];
const TRANSCRIPT_DIR = join(process.cwd(), "tmp", "tui-interactive-transcripts");
const EXPECT_PATH = Bun.which("expect");
const RUN_INTERACTIVE_TUI_TESTS = process.env.RUN_INTERACTIVE_TUI_TESTS === "1";

function getSkipReason(): string | null {
	if (process.platform === "win32") {
		return "interactive PTY tests require a Unix-like environment";
	}
	if (!RUN_INTERACTIVE_TUI_TESTS) {
		return "set RUN_INTERACTIVE_TUI_TESTS=1 to enable interactive PTY tests";
	}
	if (!EXPECT_PATH) {
		return "expect is not installed";
	}
	return null;
}

const skipReason = getSkipReason();
if (skipReason) {
	console.warn(`[tui-task-list-order] Skipping interactive task list order tests: ${skipReason}`);
}
const itInteractive = skipReason ? it.skip : it;

const tclWords = (words: string[]) => words.map((word) => `{${word}}`).join(" ");

/**
 * Runs an interactive command in a pseudo-terminal and returns everything it wrote.
 *
 * `steps` is expect script that runs once the first frame is on screen and before the session
 * quits. A `snapshot <name>` step, for use while the task list is showing, writes the marker
 * `@@<name>@@` into the transcript and resizes the terminal by one column. That makes the TUI
 * redraw the whole screen, so after the marker the transcript holds one complete frame, top to
 * bottom, however little had changed.
 */
async function runTerminalSession(options: {
	projectDir: string;
	args: string[];
	steps: string;
	/** The locale the command sees. A locale without UTF-8 makes the TUI draw its ASCII glyphs. */
	locale?: string;
	/** Keys that end the session; a view that starts in the search field has to leave it first. */
	quitKeys?: string;
}): Promise<string> {
	await mkdir(TRANSCRIPT_DIR, { recursive: true });
	const transcriptPath = join(
		TRANSCRIPT_DIR,
		`task-list-order-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
	);
	const scriptPath = join(options.projectDir, `session-${Date.now()}.expect`);
	const locale = options.locale ?? "en_US.UTF-8";
	await writeFile(
		scriptPath,
		`#!/usr/bin/expect -f
set timeout 30
log_user 0
log_file -a {${transcriptPath}}
set env(TERM) {xterm-256color}
set env(LANG) {${locale}}
set env(LC_ALL) {${locale}}
catch {unset env(LC_CTYPE)}
catch {unset env(LANGUAGE)}
catch {unset env(NCURSES_FORCE_UNICODE)}
set columns 120
set stty_init "rows 30 columns $columns"

# Reads, and so logs, whatever the terminal still has to deliver.
proc settle {} { expect -timeout 1 "__never__" }

proc snapshot {name} {
	global spawn_out columns
	settle
	send_log "\\n@@$name@@\\n"
	incr columns
	stty rows 30 columns $columns < $spawn_out(slave,name)
	# The label of the list pane starts the frame; settle then reads the rest of it.
	expect {
		-re {Tasks} {}
		timeout { exit 92 }
	}
	settle
}

spawn ${tclWords([...CLI_COMMAND, ...options.args])}
expect {
	-re {Quit} {}
	timeout { exit 91 }
}
${options.steps}
settle
send "${options.quitKeys ?? "q"}"
expect eof
exit 0
`,
	);

	const child = Bun.spawn([EXPECT_PATH as string, "-f", scriptPath], {
		cwd: options.projectDir,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(
			`The terminal session for "${options.args.join(" ")}" ended with ${exitCode} (91: the first frame never appeared, 92: a snapshot never redrew, other codes: a step timed out).\nTranscript: ${transcriptPath}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
		);
	}
	return await readFile(transcriptPath, "utf8");
}

/** The text of the frame a `snapshot <name>` step captured, without the escape sequences that place and color it. */
function snapshotText(transcript: string, name: string): string {
	const frame = transcript.split(`@@${name}@@`)[1]?.split("@@")[0];
	if (frame === undefined) throw new Error(`The transcript has no snapshot named ${name}.`);
	const esc = String.fromCharCode(27);
	const bell = String.fromCharCode(7);
	return (
		frame
			// The TUI steps over blank cells with a cursor move instead of printing spaces.
			.replace(new RegExp(`${esc}\\[(\\d*)C`, "g"), (_move, cells: string) => " ".repeat(Number(cells) || 1))
			.replace(new RegExp(`${esc}\\][^${bell}${esc}]*(?:${bell}|${esc}\\\\)`, "g"), "")
			.replace(new RegExp(`${esc}\\[[0-9;?]*[ -/]*[@-~]`, "g"), "")
			.replace(new RegExp(`${esc}[()][0-9A-Za-z]`, "g"), "")
	);
}

/**
 * What a snapshot shows of the task list: the selected task and the rows, top to bottom. A frame
 * prints the detail header of the selected task on the line above the first row, so the task ID
 * right before the run of row IDs is the selection.
 */
function readList(transcript: string, name: string, expectedRows: string[]) {
	const ids = snapshotText(transcript, name).match(/TASK-\d+/g) ?? [];
	const printed = ids.join(" ");
	const rowsAt = printed.indexOf(expectedRows.join(" "));
	return {
		printed,
		showsRows: rowsAt >= 0,
		selected: rowsAt > 0 ? printed.slice(0, rowsAt).trim().split(" ").at(-1) : undefined,
	};
}

/** The task IDs `task list --plain` prints for the same options, in printed order. */
async function plainRows(projectDir: string, args: string[]): Promise<string[]> {
	const child = Bun.spawn([...CLI_COMMAND, "task", "list", ...args, "--plain"], { cwd: projectDir, stdout: "pipe" });
	const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);
	expect(exitCode).toBe(0);
	return stdout.match(/TASK-\d+/g) ?? [];
}

describe("interactive task list order", () => {
	const projectDir = createUniqueTestDir("tui-task-list-order");
	const changedProjectDir = createUniqueTestDir("tui-task-list-order-changed");

	beforeAll(async () => {
		if (skipReason) return;
		for (const directory of [projectDir, changedProjectDir]) {
			const core = await createOrderFixtureProject(directory);
			core.disposeSearchService();
			core.disposeContentStore();
		}
	});

	afterAll(async () => {
		await safeCleanup(projectDir);
		await safeCleanup(changedProjectDir);
	});

	itInteractive(
		"shows the rows --plain prints, in the same order, for the default order and every option",
		async () => {
			for (const options of [[], ["--sort", "priority"], ["--sort", "id"], ["--sort", "ordinal"], ["--limit", "3"]]) {
				const rows = await plainRows(projectDir, options);
				const transcript = await runTerminalSession({
					projectDir,
					args: ["task", "list", ...options],
					steps: "snapshot list",
				});
				const list = readList(transcript, "list", rows);

				expect([options.join(" "), list.printed]).toEqual([options.join(" "), expect.stringContaining(rows.join(" "))]);
				// A list opened without a chosen task starts on its first row.
				expect([options.join(" "), list.selected]).toEqual([options.join(" "), rows[0]]);
			}
		},
		120_000,
	);

	itInteractive(
		"shows the default order when the list is reached from the board, a task view, or search",
		async () => {
			const rows = await plainRows(projectDir, []);

			const fromBoard = await runTerminalSession({
				projectDir,
				args: ["board"],
				// Forget the board's own footer, switch views, and wait for the list to draw its footer.
				steps: `expect "*"\nsend "\\t"\nexpect {\n\t-re {Quit} {}\n\ttimeout { exit 93 }\n}\nsnapshot list`,
			});
			expect(readList(fromBoard, "list", rows).printed).toContain(rows.join(" "));

			const fromTaskView = await runTerminalSession({ projectDir, args: ["task", "TASK-1"], steps: "snapshot list" });
			const taskViewList = readList(fromTaskView, "list", rows);
			expect(taskViewList.printed).toContain(rows.join(" "));
			// The task that was asked for stays selected, wherever its row is.
			expect(taskViewList.selected).toBe("TASK-1");

			const searchRows = await plainRows(projectDir, ["--search", "orchard"]);
			expect(searchRows.length).toBeGreaterThan(2);
			const fromSearch = await runTerminalSession({
				projectDir,
				args: ["search", "orchard"],
				steps: "snapshot list",
				// The search view starts in its search field, where q is text.
				quitKeys: "\\033\\033q",
			});
			expect(readList(fromSearch, "list", searchRows).printed).toContain(searchRows.join(" "));
		},
		120_000,
	);

	itInteractive(
		"keeps an open list sorted and its selection on the same task when tasks change on disk",
		async () => {
			const rowsBefore = await plainRows(changedProjectDir, []);
			const selectedBefore = rowsBefore[1];
			const transcript = await runTerminalSession({
				projectDir: changedProjectDir,
				args: ["task", "list"],
				// Select the second row, then give the last To Do task the lowest ordinal from another
				// process, which moves it to the first row.
				steps: `send "j"
snapshot before
expect "*"
catch {exec ${tclWords([...CLI_COMMAND, "task", "edit", "TASK-5", "--ordinal", "50"])}}
expect -timeout 10 -re {Echo}
snapshot after`,
			});
			const rowsAfter = await plainRows(changedProjectDir, []);
			expect(rowsAfter).not.toEqual(rowsBefore);
			expect(rowsAfter[0]).toBe("TASK-5");

			expect(readList(transcript, "before", rowsBefore)).toMatchObject({ showsRows: true, selected: selectedBefore });
			expect(readList(transcript, "after", rowsAfter)).toMatchObject({ showsRows: true, selected: selectedBefore });
		},
		120_000,
	);

	itInteractive(
		"marks each configured priority with an arrow, and with an ASCII arrow without Unicode",
		async () => {
			const unicode = snapshotText(
				await runTerminalSession({ projectDir, args: ["task", "list"], steps: "snapshot list" }),
				"list",
			);
			// now, next, later: up, right, down. A task without a priority keeps the dash.
			for (const row of ["TASK-3 ↑ Charlie", "TASK-6 → Foxtrot", "TASK-1 ↓ Alpha", "TASK-5 - Echo"]) {
				expect(unicode).toContain(row);
			}

			const ascii = snapshotText(
				await runTerminalSession({ projectDir, args: ["task", "list"], steps: "snapshot list", locale: "C" }),
				"list",
			);
			for (const row of ["TASK-3 ^ Charlie", "TASK-6 > Foxtrot", "TASK-1 v Alpha", "TASK-5 - Echo"]) {
				expect(ascii).toContain(row);
			}
			expect(ascii).not.toContain("↑");
		},
		120_000,
	);
});
