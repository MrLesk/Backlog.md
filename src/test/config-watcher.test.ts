import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFileSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { FileSystem } from "../file-system/operations.ts";
import type { BacklogConfig } from "../types/index.ts";
import { watchConfig, watchConfigFile } from "../utils/config-watcher.ts";
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

	it("keeps the last valid config cached while stable unusable content waits for a valid replacement", async () => {
		const canonicalContent = await Bun.file(core.filesystem.configFilePath).text();
		const stableContent = canonicalContent
			.replace('project_name: "Config watcher"', 'project_name: "Stable config"')
			.replace("check_active_branches: true", "check_active_branches: false");
		const unusableContents = [
			[
				'project_name: ""',
				'statuses: ["To Do", "Done"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: false",
				'task_prefix: "BACK"',
				"",
			].join("\n"),
			[
				'project_name: "Malformed boolean"',
				'statuses: ["To Do", "Done"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: fals",
				'task_prefix: "BACK"',
				"",
			].join("\n"),
			[
				'project_name: "Malformed active days"',
				'statuses: ["To Do", "Done"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: true",
				"active_branch_days: nope",
				'task_prefix: "BACK"',
				"",
			].join("\n"),
			[
				'project_name: "Malformed task prefix"',
				'statuses: ["To Do", "Done"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: true",
				"active_branch_days: 30",
				'task_prefix: "BACK-2"',
				"",
			].join("\n"),
		];
		const originalParseConfig = core.filesystem.parseConfig.bind(core.filesystem);
		const unusableParseAttempts = new Map(unusableContents.map((content) => [content, 0]));
		const unusableAttemptResolvers = new Map<string, () => void>();
		const unusableAttempts = new Map(
			unusableContents.map((content) => [
				content,
				new Promise<void>((resolve) => unusableAttemptResolvers.set(content, resolve)),
			]),
		);
		core.filesystem.parseConfig = (content) => {
			const parsed = originalParseConfig(content);
			const attempts = unusableParseAttempts.get(content);
			if (attempts !== undefined) {
				const nextAttempts = attempts + 1;
				unusableParseAttempts.set(content, nextAttempts);
				if (nextAttempts >= 8) {
					unusableAttemptResolvers.get(content)?.();
				}
			}
			return parsed;
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
			for (const [index, unusableContent] of unusableContents.entries()) {
				await replaceConfigFile(unusableContent);
				const unusableAttempt = unusableAttempts.get(unusableContent);
				if (!unusableAttempt) throw new Error("Missing unusable config attempt signal");
				await withTimeout(unusableAttempt, `unusable config ${index + 1} read attempts`);

				const cachedConfigs = await Promise.all(Array.from({ length: 20 }, () => core.filesystem.loadConfig()));
				expect(cachedConfigs).toHaveLength(20);
				for (const cachedConfig of cachedConfigs) {
					expect(cachedConfig?.projectName).toBe(initialConfig.projectName);
					expect(cachedConfig?.checkActiveBranches).toBe(true);
					expect(cachedConfig?.prefixes?.task).toBe("BACK");
				}
				expect(published).toHaveLength(0);
			}

			await replaceConfigFile(stableContent);

			const config = await withTimeout(publishedConfig, "stable config callback");
			expect(config.projectName).toBe("Stable config");
			expect(config.checkActiveBranches).toBe(false);
			expect(config.prefixes?.task).toBe("BACK");
			expect(published).toHaveLength(1);
			expect((await core.filesystem.loadConfig())?.projectName).toBe("Stable config");
		} finally {
			configWatcher.stop();
			core.filesystem.parseConfig = originalParseConfig;
		}
	});

	it("publishes root config resolution from the same accepted content", async () => {
		const rootDir = createUniqueTestDir("config-watcher-root");
		const rootConfigPath = join(rootDir, "backlog.config.yml");
		const candidateContent = [
			'project_name: "Candidate"',
			'backlog_directory: "custom/a"',
			'statuses: ["To Do", "Done"]',
			"labels: []",
			"date_format: YYYY-MM-DD",
			"check_active_branches: true",
			"",
		].join("\n");
		const interveningInvalidContent = [
			'project_name: ""',
			'backlog_directory: "custom/b"',
			"check_active_branches: false",
			"",
		].join("\n");
		const sparseRootContent = [
			'project_name: "Sparse root"',
			'statuses: ["To Do", "Done"]',
			"labels: []",
			"date_format: YYYY-MM-DD",
			"check_active_branches: true",
			"",
		].join("\n");
		const invalidPointerContent = [
			'project_name: "Broken pointer"',
			'backlog_directory: "../escape"',
			'statuses: ["To Do", "Done"]',
			"labels: []",
			"date_format: YYYY-MM-DD",
			"check_active_branches: true",
			"",
		].join("\n");
		const nextValidContent = candidateContent
			.replace('project_name: "Candidate"', 'project_name: "Next valid"')
			.replace('backlog_directory: "custom/a"', 'backlog_directory: "custom/b"');
		await mkdir(join(rootDir, "custom", "a"), { recursive: true });
		await mkdir(join(rootDir, "custom", "b"), { recursive: true });
		await Bun.write(rootConfigPath, candidateContent.replace('project_name: "Candidate"', 'project_name: "Initial"'));
		const rootFilesystem = new FileSystem(rootDir);
		expect((await rootFilesystem.loadConfig())?.projectName).toBe("Initial");
		const originalParseConfig = rootFilesystem.parseConfig.bind(rootFilesystem);
		let injectedInterveningContent = false;
		let sparseRootAttempts = 0;
		let invalidPointerAttempts = 0;
		let resolveSparseRootAttempts: () => void = () => {};
		let resolveInvalidPointerAttempts: () => void = () => {};
		const sparseRootAttemptsExhausted = new Promise<void>((resolve) => {
			resolveSparseRootAttempts = resolve;
		});
		const invalidPointerAttemptsExhausted = new Promise<void>((resolve) => {
			resolveInvalidPointerAttempts = resolve;
		});
		rootFilesystem.parseConfig = (content) => {
			const config = originalParseConfig(content);
			if (!injectedInterveningContent && content === candidateContent) {
				injectedInterveningContent = true;
				writeFileSync(rootConfigPath, interveningInvalidContent);
			}
			if (content === sparseRootContent) {
				sparseRootAttempts += 1;
				if (sparseRootAttempts >= 8) resolveSparseRootAttempts();
			}
			if (content === invalidPointerContent) {
				invalidPointerAttempts += 1;
				if (invalidPointerAttempts >= 8) resolveInvalidPointerAttempts();
			}
			return config;
		};
		type RootConfigSnapshot = { config: BacklogConfig; backlogDirName: string; configPath: string };
		let callbackCount = 0;
		let resolveFirstPublished: (snapshot: RootConfigSnapshot) => void = () => {};
		let resolveSecondPublished: (snapshot: RootConfigSnapshot) => void = () => {};
		const firstPublished = new Promise<RootConfigSnapshot>((resolve) => {
			resolveFirstPublished = resolve;
		});
		const secondPublished = new Promise<RootConfigSnapshot>((resolve) => {
			resolveSecondPublished = resolve;
		});
		const configWatcher = watchConfigFile(rootFilesystem, {
			onConfigChanged: (config) => {
				if (!config) return;
				callbackCount += 1;
				const snapshot = {
					config,
					backlogDirName: rootFilesystem.backlogDirName,
					configPath: rootFilesystem.configFilePath,
				};
				if (callbackCount === 1) resolveFirstPublished(snapshot);
				if (callbackCount === 2) resolveSecondPublished(snapshot);
			},
		});

		try {
			const replacementPath = `${rootConfigPath}.replacement`;
			await Bun.write(replacementPath, candidateContent);
			await rename(replacementPath, rootConfigPath);
			const snapshot = await withTimeout(firstPublished, "root config publication");
			expect(injectedInterveningContent).toBe(true);
			expect(snapshot.config.projectName).toBe("Candidate");
			expect(snapshot.config.backlogDirectory).toBe("custom/a");
			expect(snapshot.backlogDirName).toBe("custom/a");
			expect(snapshot.configPath).toBe(rootConfigPath);
			expect((await rootFilesystem.loadConfig())?.projectName).toBe("Candidate");
			expect(rootFilesystem.backlogDirName).toBe("custom/a");

			await Bun.write(replacementPath, sparseRootContent);
			await rename(replacementPath, rootConfigPath);
			await withTimeout(sparseRootAttemptsExhausted, "sparse root config attempts");
			expect(callbackCount).toBe(1);
			expect((await rootFilesystem.loadConfig())?.projectName).toBe("Candidate");
			expect(rootFilesystem.backlogDirName).toBe("custom/a");
			expect(rootFilesystem.configFilePath).toBe(rootConfigPath);

			await mkdir(join(rootDir, "backlog"), { recursive: true });
			await Bun.write(replacementPath, invalidPointerContent);
			await rename(replacementPath, rootConfigPath);
			await withTimeout(invalidPointerAttemptsExhausted, "invalid root pointer attempts");
			expect(callbackCount).toBe(1);
			expect((await rootFilesystem.loadConfig())?.projectName).toBe("Candidate");
			expect(rootFilesystem.backlogDirName).toBe("custom/a");
			expect(rootFilesystem.configFilePath).toBe(rootConfigPath);

			await Bun.write(replacementPath, nextValidContent);
			await rename(replacementPath, rootConfigPath);
			const nextSnapshot = await withTimeout(secondPublished, "next valid root config publication");
			expect(nextSnapshot.config.projectName).toBe("Next valid");
			expect(nextSnapshot.config.backlogDirectory).toBe("custom/b");
			expect(nextSnapshot.backlogDirName).toBe("custom/b");
			expect(nextSnapshot.configPath).toBe(rootConfigPath);
			expect((await rootFilesystem.loadConfig())?.projectName).toBe("Next valid");
			await Bun.sleep(250);
			expect(callbackCount).toBe(2);
		} finally {
			configWatcher.stop();
			rootFilesystem.parseConfig = originalParseConfig;
			await safeCleanup(rootDir);
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

	it("retries publication beyond the read budget and suppresses duplicate delivery after success", async () => {
		const canonicalContent = await Bun.file(core.filesystem.configFilePath).text();
		const updatedContent = canonicalContent.replace(
			'project_name: "Config watcher"',
			'project_name: "Retried publication"',
		);
		let callbackAttempts = 0;
		const cachedProjectNames: string[] = [];
		let resolvePublished: () => void = () => {};
		const published = new Promise<void>((resolve) => {
			resolvePublished = resolve;
		});
		const configWatcher = watchConfig(core, {
			onConfigChanged: async (config) => {
				callbackAttempts += 1;
				cachedProjectNames.push((await core.filesystem.loadConfig())?.projectName ?? "");
				if (callbackAttempts <= 10) {
					throw new Error("Injected publication failure");
				}
				expect(config?.projectName).toBe("Retried publication");
				resolvePublished();
			},
		});

		try {
			await replaceConfigFile(updatedContent);
			await withTimeout(published, "retried config publication");
			expect(callbackAttempts).toBe(11);
			expect(cachedProjectNames).toEqual(Array.from({ length: 11 }, () => "Retried publication"));

			await replaceConfigFile(updatedContent);
			await Bun.sleep(250);
			expect(callbackAttempts).toBe(11);
		} finally {
			configWatcher.stop();
		}
	});

	it("does not keep a child process alive when only the missing-file poll fallback exists", async () => {
		const missingProjectRoot = join(testDir, "missing-parent", "project");
		const script = `
			import { FileSystem } from "./src/file-system/operations.ts";
			import { watchConfigFile } from "./src/utils/config-watcher.ts";
			watchConfigFile(new FileSystem(${JSON.stringify(missingProjectRoot)}), {});
		`;
		const child = Bun.spawn(["bun", "-e", script], {
			cwd: process.cwd(),
			stdin: "ignore",
			stdout: "ignore",
			stderr: "pipe",
		});

		try {
			const exitCode = await withTimeout(child.exited, "unrefed config watcher child exit");
			if (exitCode !== 0) {
				const stderr = child.stderr ? await new Response(child.stderr).text() : "";
				throw new Error(`Watcher child exited with ${exitCode}: ${stderr}`);
			}
			expect(exitCode).toBe(0);
		} finally {
			child.kill();
		}
	});
});
