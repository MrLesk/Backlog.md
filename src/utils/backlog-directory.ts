import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES, PROFILE_CONFIG } from "../constants/index.ts";

export type BacklogDirectorySource = "backlog" | ".backlog" | "profile";

export interface BacklogDirectoryResolution {
	projectRoot: string;
	backlogDir: string | null;
	backlogPath: string | null;
	source: BacklogDirectorySource | null;
	profileBacklogDir: string | null;
	profileBacklogPath: string | null;
	profileBacklogExists: boolean;
	profileConfigPath: string;
}

function getUserHomeDir(): string {
	return process.env.HOME?.trim() || homedir();
}

function directoryExists(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function fileExists(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function parseBacklogDirectoryConfig(content: string): string | null {
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}
		const key = line.slice(0, colonIndex).trim();
		if (key !== "backlog_directory" && key !== "backlogDirectory") {
			continue;
		}
		const value = line
			.slice(colonIndex + 1)
			.trim()
			.replace(/^['"]|['"]$/g, "");
		return normalizeProjectBacklogDirectory(value);
	}
	return null;
}

export function normalizeProjectBacklogDirectory(value: string | null | undefined): string | null {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) {
		return null;
	}
	if (isAbsolute(trimmed)) {
		return null;
	}

	const normalized = normalize(trimmed).replace(/\\/g, "/").replace(/\/+$/g, "");
	if (!normalized || normalized === ".") {
		return null;
	}
	if (normalized === ".." || normalized.startsWith("../")) {
		return null;
	}
	return normalized;
}

export function resolveUserBacklogConfigPath(
	platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
	userHome = getUserHomeDir(),
): string {
	if (platform === "win32") {
		const appDataRoot = env.APPDATA?.trim() || join(userHome, PROFILE_CONFIG.WINDOWS_DIR);
		return join(appDataRoot, PROFILE_CONFIG.APP_DIR, DEFAULT_FILES.CONFIG_YAML);
	}

	return join(userHome, PROFILE_CONFIG.UNIX_DIR, DEFAULT_FILES.CONFIG_YAML);
}

export function getUserBacklogConfigPath(): string {
	return resolveUserBacklogConfigPath();
}

export function readUserConfiguredBacklogDirectory(): string | null {
	const configPath = getUserBacklogConfigPath();
	if (!fileExists(configPath)) {
		return null;
	}
	try {
		return parseBacklogDirectoryConfig(readFileSync(configPath, "utf8"));
	} catch {
		return null;
	}
}

export function writeUserConfiguredBacklogDirectory(backlogDir: string): void {
	const normalized = normalizeProjectBacklogDirectory(backlogDir);
	if (!normalized) {
		throw new Error("Backlog directory must be a project-relative path.");
	}
	const configPath = getUserBacklogConfigPath();
	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, `backlog_directory: "${normalized}"\n`);
}

export function resolveBacklogDirectory(projectRoot: string): BacklogDirectoryResolution {
	const defaultBacklogPath = join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
	if (directoryExists(defaultBacklogPath)) {
		return {
			projectRoot,
			backlogDir: DEFAULT_DIRECTORIES.BACKLOG,
			backlogPath: defaultBacklogPath,
			source: "backlog",
			profileBacklogDir: null,
			profileBacklogPath: null,
			profileBacklogExists: false,
			profileConfigPath: getUserBacklogConfigPath(),
		};
	}

	const hiddenBacklogPath = join(projectRoot, DEFAULT_DIRECTORIES.HIDDEN_BACKLOG);
	if (directoryExists(hiddenBacklogPath)) {
		return {
			projectRoot,
			backlogDir: DEFAULT_DIRECTORIES.HIDDEN_BACKLOG,
			backlogPath: hiddenBacklogPath,
			source: ".backlog",
			profileBacklogDir: null,
			profileBacklogPath: null,
			profileBacklogExists: false,
			profileConfigPath: getUserBacklogConfigPath(),
		};
	}

	const profileBacklogDir = readUserConfiguredBacklogDirectory();
	const profileBacklogPath = profileBacklogDir ? join(projectRoot, profileBacklogDir) : null;
	const profileBacklogExists = profileBacklogPath ? directoryExists(profileBacklogPath) : false;
	if (profileBacklogDir && profileBacklogPath && profileBacklogExists) {
		return {
			projectRoot,
			backlogDir: profileBacklogDir,
			backlogPath: profileBacklogPath,
			source: "profile",
			profileBacklogDir,
			profileBacklogPath,
			profileBacklogExists,
			profileConfigPath: getUserBacklogConfigPath(),
		};
	}

	return {
		projectRoot,
		backlogDir: null,
		backlogPath: null,
		source: null,
		profileBacklogDir,
		profileBacklogPath,
		profileBacklogExists,
		profileConfigPath: getUserBacklogConfigPath(),
	};
}
