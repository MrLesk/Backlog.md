import { type FSWatcher, watch } from "node:fs";
import type { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

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
		timer = setInterval(refresh, 1000);
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
