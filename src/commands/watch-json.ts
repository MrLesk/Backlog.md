import { type FSWatcher, readdirSync, statSync, watch } from "node:fs";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

// The process that started this one: the parent, and also the launcher's parent when the npm launcher is the parent.
// Captured when the CLI loads, before parsing and project lookup, so a starter that exits during setup still counts.
const parent = process.ppid;
const [launcher, launcherParent] = (process.env.BACKLOG_LAUNCHER ?? "").split(":").map(Number);
const starters = launcher === parent ? [parent, launcherParent] : [parent];

/** POSIX reparents orphans; Windows does not, so the PIDs are probed as well. */
function starterExited(): boolean {
	return process.ppid !== parent || !starters.every(isRunning);
}

/** Only a process that no longer exists counts as ended; unknown PIDs and other errors never end the watch. */
function isRunning(pid: number | undefined): boolean {
	if (!pid || pid < 1) return true;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== "ESRCH";
	}
}

/**
 * Sizes and change times of what the read loads: the given files, and the entries of the given
 * directories one level deep, following symlinks like the loaders. This stat pass is far cheaper
 * than a full read and repairs missed notifications. The ctime also moves when a copy keeps the mtime.
 */
export function filesSignature(inputs: string[]): string {
	const describe = (path: string, name: string) => {
		try {
			const stats = statSync(path);
			return `${name}\0${stats.size}\0${stats.mtimeMs}\0${stats.ctimeMs}`;
		} catch {
			// Missing, dangling or looping entries count by name only.
			return name;
		}
	};
	return inputs
		.flatMap((input) => {
			try {
				return [
					input,
					...readdirSync(input)
						.sort()
						.map((name) => describe(join(input, name), name)),
				];
			} catch {
				// A file, or a directory that does not exist yet.
				return [describe(input, input)];
			}
		})
		.join("\n");
}

/** Stream the canonical read's bytes. Notifications are hints; a periodic stat pass repairs missed events. */
export async function watchJson(
	directories: string[],
	inputs: string[],
	read: () => Promise<string | undefined>,
	output: Writable = process.stdout,
): Promise<void> {
	const controller = new AbortController();
	const { signal } = controller;
	const watchers: FSWatcher[] = [];
	let seen: string | undefined;
	let failure: Error | undefined;
	let pending = true;
	let wake: (() => void) | undefined;
	let previous: string | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;

	const refresh = () => {
		pending = true;
		wake?.();
	};
	const stop = () => {
		if (signal.aborted) return;
		controller.abort();
		if (output.writableLength && !output.destroyed) output.destroy();
		wake?.();
	};
	const fail = (error: Error) => {
		failure = error;
		stop();
	};
	const onOutputError = (error: NodeJS.ErrnoException) => {
		if (error.code === "EPIPE") stop();
		else fail(error);
	};
	const onInterrupt = () => {
		process.exitCode = 130;
		stop();
	};
	const onTerminate = () => {
		process.exitCode = 143;
		stop();
	};

	// Await each write, including slow pipes. There is only one write and one pending refresh,
	// never a queue of snapshots. Aborting also releases a write blocked on an unread pipe.
	const write = (value: string) =>
		new Promise<void>((resolve, reject) => {
			const onAbort = () => resolve();
			signal.addEventListener("abort", onAbort, { once: true });
			output.write(value, (error) => {
				signal.removeEventListener("abort", onAbort);
				if (error) {
					onOutputError(error);
					if (failure) reject(failure);
					else resolve();
				} else resolve();
			});
		});

	process.on("SIGINT", onInterrupt);
	process.on("SIGTERM", onTerminate);
	output.on("error", onOutputError);
	output.on("close", stop);
	try {
		// Register before reading so changes during startup always schedule another pass.
		for (const directory of new Set(directories)) {
			const watcher = watch(directory, { recursive: directory === directories[0] }, refresh);
			watcher.on("error", fail);
			watchers.push(watcher);
		}
		// A killed starter cannot stop the watch, so end with it like a termination request. A full read
		// can be expensive in large projects, so an idle watch otherwise only compares stats.
		timer = setInterval(() => {
			if (starterExited()) onTerminate();
			else if (filesSignature(inputs) !== seen) refresh();
		}, 1000);
		while (!signal.aborted) {
			pending = false;
			// Taken before reading: a change during the read differs from it and schedules another pass.
			seen = filesSignature(inputs);
			const value = await read();
			// The CLI already explained validation failures on stderr. Never emit an empty
			// replacement when no successful JSON response was produced.
			if (value === undefined || signal.aborted) break;
			if (value !== previous) {
				await write(value);
				previous = value;
			}
			if (signal.aborted) break;
			if (!pending) {
				await new Promise<void>((resolve) => {
					wake = resolve;
				});
				wake = undefined;
			}
			// Coalesce editor save bursts without postponing refresh indefinitely.
			await delay(50, undefined, { signal });
		}
	} catch (error) {
		if (!signal.aborted) throw error;
	} finally {
		if (timer) clearInterval(timer);
		for (const watcher of watchers) watcher.close();
		process.off("SIGINT", onInterrupt);
		process.off("SIGTERM", onTerminate);
		output.off("close", stop);
		// Destroyed streams can emit their final error before close. Keep the handler
		// until then, including when cancellation interrupted a blocked write.
		if (output.destroyed && !output.closed) {
			output.once("close", () => output.off("error", onOutputError));
		} else {
			output.off("error", onOutputError);
		}
	}
	if (failure) throw failure;
}
