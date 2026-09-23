import { type FSWatcher, watch } from "node:fs";
import type { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Returns a check for whether the process that started this one has exited: the parent, and also the launcher's parent
 * when the npm launcher is the parent. POSIX reparents orphans; Windows does not, so the PIDs are probed as well.
 */
function observeStarter(): () => boolean {
	const parent = process.ppid;
	const [launcher, launcherParent] = (process.env.BACKLOG_LAUNCHER ?? "").split(":").map(Number);
	const starters = launcher === parent ? [parent, launcherParent] : [parent];
	return () => process.ppid !== parent || !starters.every(isRunning);
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

/** Stream the canonical read's bytes. Notifications are hints; periodic reads repair missed events. */
export async function watchJson(
	directories: string[],
	read: () => Promise<string | undefined>,
	output: Writable = process.stdout,
): Promise<void> {
	const controller = new AbortController();
	const { signal } = controller;
	const watchers: FSWatcher[] = [];
	let failure: Error | undefined;
	let pending = true;
	let wake: (() => void) | undefined;
	let previous: string | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;
	const starterExited = observeStarter();

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
		// A killed starter cannot stop the watch, so end with it like a termination request.
		timer = setInterval(() => (starterExited() ? onTerminate() : refresh()), 1000);
		while (!signal.aborted) {
			pending = false;
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
