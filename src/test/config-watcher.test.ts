import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rename } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig } from "../types/index.ts";
import { watchConfig } from "../utils/config-watcher.ts";
import { createUniqueTestDir, getPlatformTimeout, safeCleanup } from "./test-utils.ts";

let testDir: string;
let core: Core;

const initialConfig: BacklogConfig = {
	projectName: "Config watcher",
	statuses: ["To Do", "Done"],
	labels: ["web"],
	dateFormat: "YYYY-MM-DD",
	remoteOperations: false,
	checkActiveBranches: true,
	prefixes: { task: "BACK" },
};

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), getPlatformTimeout(3000));
		promise.then(
			(value) => {
				clearTimeout(timeout);
				resolve(value);
			},
			(error) => {
				clearTimeout(timeout);
				reject(error);
			},
		);
	});
}

async function replaceConfigFile(content: string): Promise<void> {
	const configPath = core.filesystem.configFilePath;
	const replacementPath = `${configPath}.replacement`;
	await Bun.write(replacementPath, content);
	await rename(replacementPath, configPath);
}

describe("config watcher", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("config-watcher");
		core = new Core(testDir);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(initialConfig);
	});

	afterEach(async () => {
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	it("waits through partial content and a transient null read before publishing the valid custom-prefix config", async () => {
		const canonicalContent = await Bun.file(core.filesystem.configFilePath).text();
		const stableContent = canonicalContent
			.replace('project_name: "Config watcher"', 'project_name: "Stable config"')
			.replace("check_active_branches: true", "check_active_branches: false");
		const originalLoadConfig = core.filesystem.loadConfig.bind(core.filesystem);
		let injectTransientNull = true;
		let loadAttempts = 0;
		let resolveTransientRead: () => void = () => {};
		const transientRead = new Promise<void>((resolve) => {
			resolveTransientRead = resolve;
		});
		core.filesystem.loadConfig = async () => {
			loadAttempts += 1;
			if (injectTransientNull) {
				injectTransientNull = false;
				resolveTransientRead();
				return null;
			}
			return await originalLoadConfig();
		};

		const published: BacklogConfig[] = [];
		let resolvePublished: (config: BacklogConfig) => void = () => {};
		const publishedConfig = new Promise<BacklogConfig>((resolve) => {
			resolvePublished = resolve;
		});
		const configWatcher = watchConfig(core, {
			onConfigChanged: (config) => {
				if (!config) return;
				published.push(config);
				resolvePublished(config);
			},
		});

		try {
			await replaceConfigFile('project_name: "Partial write"\n');
			await withTimeout(transientRead, "transient null config read");
			await replaceConfigFile(stableContent);

			const config = await withTimeout(publishedConfig, "stable config callback");
			expect(config.projectName).toBe("Stable config");
			expect(config.checkActiveBranches).toBe(false);
			expect(config.prefixes?.task).toBe("BACK");
			expect(loadAttempts).toBeGreaterThanOrEqual(2);
			expect(published).toHaveLength(1);
		} finally {
			configWatcher.stop();
			core.filesystem.loadConfig = originalLoadConfig;
		}
	});

	it("publishes a stable prefix-only edit to the canonical config", async () => {
		const canonicalContent = await Bun.file(core.filesystem.configFilePath).text();
		const prefixEdit = canonicalContent.replace('task_prefix: "BACK"', 'task_prefix: "JIRA"');
		let resolvePublished: (config: BacklogConfig) => void = () => {};
		const publishedConfig = new Promise<BacklogConfig>((resolve) => {
			resolvePublished = resolve;
		});
		const configWatcher = watchConfig(core, {
			onConfigChanged: (config) => {
				if (config) resolvePublished(config);
			},
		});

		try {
			await replaceConfigFile(prefixEdit);
			const config = await withTimeout(publishedConfig, "prefix-only config callback");
			expect(config.projectName).toBe(initialConfig.projectName);
			expect(config.prefixes?.task).toBe("JIRA");
			expect(config.checkActiveBranches).toBe(true);
		} finally {
			configWatcher.stop();
		}
	});

	it("keeps accepting the sparse config shape supported by the parser", async () => {
		let resolvePublished: (config: BacklogConfig) => void = () => {};
		const publishedConfig = new Promise<BacklogConfig>((resolve) => {
			resolvePublished = resolve;
		});
		const configWatcher = watchConfig(core, {
			onConfigChanged: (config) => {
				if (config) resolvePublished(config);
			},
		});

		try {
			await replaceConfigFile('project_name: "Sparse config"\ntask_prefix: "SPARSE"\n');
			const config = await withTimeout(publishedConfig, "sparse config callback");
			expect(config.projectName).toBe("Sparse config");
			expect(config.prefixes?.task).toBe("SPARSE");
			expect(config.statuses.length).toBeGreaterThan(0);
			expect(config.labels).toEqual([]);
			expect(config.dateFormat).toBe("yyyy-mm-dd");
		} finally {
			configWatcher.stop();
		}
	});
});
