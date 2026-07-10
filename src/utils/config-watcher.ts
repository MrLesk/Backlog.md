import { type FSWatcher, readFileSync, unwatchFile, watch, watchFile } from "node:fs";
import { basename, dirname } from "node:path";
import type { Core } from "../core/backlog.ts";
import type { FileSystem } from "../file-system/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

export interface ConfigWatcherCallbacks {
	onConfigChanged?: (config: BacklogConfig | null) => void | Promise<void>;
}

interface ConfigWatcherHandle {
	stop(): void;
}

const CONFIG_SETTLE_DELAY_MS = 50;
const CONFIG_STABILITY_DELAY_MS = 25;
const CONFIG_READ_ATTEMPTS = 8;
const CONFIG_POLL_INTERVAL_MS = 500;

function isUsableConfig(config: BacklogConfig | null): config is BacklogConfig {
	return Boolean(
		config?.projectName.trim() &&
			Array.isArray(config.statuses) &&
			Array.isArray(config.labels) &&
			config.dateFormat.trim(),
	);
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

export function watchConfigFile(filesystem: FileSystem, callbacks: ConfigWatcherCallbacks): ConfigWatcherHandle {
	const configPath = filesystem.configFilePath;
	const configDirectory = dirname(configPath);
	const configFilename = basename(configPath);
	let watcher: FSWatcher | null = null;
	let generation = 0;
	let stopped = false;
	let processing = false;
	let pending = false;
	let lastPublishedContent: string | null = null;
	try {
		lastPublishedContent = readFileSync(configPath, "utf8");
	} catch {}

	const notifyAfterStableRead = async (eventGeneration: number): Promise<void> => {
		for (let attempt = 0; attempt < CONFIG_READ_ATTEMPTS; attempt++) {
			await delay(attempt === 0 ? CONFIG_SETTLE_DELAY_MS : CONFIG_STABILITY_DELAY_MS);
			if (stopped || eventGeneration !== generation) {
				return;
			}

			try {
				const firstContent = await Bun.file(configPath).text();
				await delay(CONFIG_STABILITY_DELAY_MS);
				if (stopped || eventGeneration !== generation) {
					return;
				}
				const secondContent = await Bun.file(configPath).text();
				if (firstContent !== secondContent) {
					continue;
				}
				if (secondContent === lastPublishedContent) {
					return;
				}

				filesystem.invalidateConfigCache();
				const config = await filesystem.loadConfig();
				if (!isUsableConfig(config)) {
					continue;
				}
				if (stopped || eventGeneration !== generation) {
					return;
				}
				await callbacks.onConfigChanged?.(config);
				lastPublishedContent = secondContent;
				return;
			} catch {
				// Atomic writes can temporarily remove or lock the watched path on Windows.
			}
		}
	};
	const drainStableReads = async (): Promise<void> => {
		if (processing) return;
		processing = true;
		try {
			do {
				pending = false;
				await notifyAfterStableRead(generation);
			} while (!stopped && pending);
		} finally {
			processing = false;
			if (!stopped && pending) {
				void drainStableReads().catch(() => {});
			}
		}
	};
	const scheduleStableRead = () => {
		generation += 1;
		pending = true;
		void drainStableReads().catch(() => {});
	};
	const pollListener = () => scheduleStableRead();
	const pollWatcher = watchFile(configPath, { interval: CONFIG_POLL_INTERVAL_MS }, pollListener);
	pollWatcher.unref();

	const stop = () => {
		stopped = true;
		generation += 1;
		unwatchFile(configPath, pollListener);
		if (watcher) {
			try {
				watcher.close();
			} catch {
				// Ignore
			}
			watcher = null;
		}
	};

	try {
		watcher = watch(configDirectory, (eventType, filename) => {
			if (eventType !== "change" && eventType !== "rename") {
				return;
			}
			const changedFilename = filename;
			if (eventType !== "rename" && changedFilename && basename(changedFilename) !== configFilename) {
				return;
			}
			scheduleStableRead();
		});
		watcher.on("error", (error) => {
			if (process.env.DEBUG) {
				console.warn("Config watcher error", error);
			}
		});
	} catch {}

	return { stop };
}

export function watchConfig(core: Core, callbacks: ConfigWatcherCallbacks): ConfigWatcherHandle {
	return watchConfigFile(core.filesystem, callbacks);
}
