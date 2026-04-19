import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES } from "../constants/index.ts";
import type { ProjectDefinition, ProjectRegistry, ResolvedProjectContext } from "../types/index.ts";
import { normalizeProjectBacklogDirectory, resolveBacklogDirectory } from "./backlog-directory.ts";

interface ProjectRegistryInput {
	version?: number;
	defaultProject?: string;
	projects: Array<{
		key?: string;
		path?: string;
	}>;
}

interface ParsedProjectEntry {
	key?: string;
	path?: string;
	keySeen?: boolean;
	pathSeen?: boolean;
}

type ProjectRegistryLoadResult =
	| { state: "missing" }
	| { state: "invalid"; path?: string }
	| { state: "valid"; registry: ProjectRegistry; registryPath: string; containerRoot: string };

function projectRegistryPath(projectRoot: string): string {
	return join(resolveProjectContainerRoot(projectRoot), DEFAULT_FILES.PROJECT_REGISTRY);
}

function projectRegistryCandidatePaths(projectRoot: string): string[] {
	const activeContainerRoot = resolveProjectContainerRoot(projectRoot);
	const candidates = [
		join(activeContainerRoot, DEFAULT_FILES.PROJECT_REGISTRY),
		join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG, DEFAULT_FILES.PROJECT_REGISTRY),
		join(projectRoot, DEFAULT_DIRECTORIES.HIDDEN_BACKLOG, DEFAULT_FILES.PROJECT_REGISTRY),
	];

	return [...new Set(candidates)];
}

function resolveProjectContainerRoot(projectRoot: string): string {
	const resolution = resolveBacklogDirectory(projectRoot);
	return resolution.backlogPath ?? join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
}

function parseScalar(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith("\"")) {
		try {
			const parsed = JSON.parse(trimmed);
			return typeof parsed === "string" ? parsed : null;
		} catch {
			return null;
		}
	}

	if (trimmed.startsWith("'")) {
		if (!trimmed.endsWith("'")) {
			return null;
		}
		return trimmed.slice(1, -1);
	}

	if (!/^[A-Za-z0-9._/-]+$/.test(trimmed)) {
		return null;
	}

	return trimmed;
}

function parseVersionScalar(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith("\"")) {
		const parsed = parseScalar(trimmed);
		if (!parsed || !/^\d+$/.test(parsed)) {
			return null;
		}
		return Number.parseInt(parsed, 10);
	}

	if (trimmed.startsWith("'")) {
		const parsed = parseScalar(trimmed);
		if (!parsed || !/^\d+$/.test(parsed)) {
			return null;
		}
		return Number.parseInt(parsed, 10);
	}

	if (!/^\d+$/.test(trimmed)) {
		return null;
	}

	return Number.parseInt(trimmed, 10);
}

function splitKeyValue(line: string): [string, string] | null {
	const colonIndex = line.indexOf(":");
	if (colonIndex === -1) {
		return null;
	}
	return [line.slice(0, colonIndex).trim(), line.slice(colonIndex + 1).trim()];
}

function normalizeProjectKey(value: string | null | undefined): string | null {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) {
		return null;
	}

	const normalized = normalize(trimmed).replace(/\\/g, "/");
	const raw = trimmed.replace(/\\/g, "/");
	if (normalized !== raw) {
		return null;
	}
	if (normalized === "." || normalized === ".." || normalized.includes("/")) {
		return null;
	}
	if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(normalized)) {
		return null;
	}

	const baseName = normalized.split(".")[0].toUpperCase();
	if (
		baseName === "CON" ||
		baseName === "PRN" ||
		baseName === "AUX" ||
		baseName === "NUL" ||
		/^COM[1-9]$/.test(baseName) ||
		/^LPT[1-9]$/.test(baseName)
	) {
		return null;
	}

	return normalized;
}

function normalizeProjectRegistry(registry: ProjectRegistryInput): ProjectRegistry | null {
	if (registry.version !== 1) {
		return null;
	}

	const normalizedProjects: ProjectDefinition[] = [];
	const seenKeys = new Set<string>();
	const seenPaths = new Set<string>();

	for (const project of registry.projects) {
		const key = normalizeProjectKey(project.key);
		const keyIdentity = key?.toLowerCase() ?? null;
		if (!key || !keyIdentity || seenKeys.has(keyIdentity)) {
			return null;
		}

		seenKeys.add(keyIdentity);

		if (project.path === undefined) {
			normalizedProjects.push({ key });
			continue;
		}

		const path = normalizeProjectBacklogDirectory(project.path);
		const pathIdentity = path ?? null;
		if (!path || !pathIdentity || seenPaths.has(pathIdentity)) {
			return null;
		}

		seenPaths.add(pathIdentity);
		normalizedProjects.push({ key, path });
	}

	const defaultProject = registry.defaultProject ? normalizeProjectKey(registry.defaultProject) : undefined;
	if (registry.defaultProject && (!defaultProject || !seenKeys.has(defaultProject.toLowerCase()))) {
		return null;
	}

	return {
		version: 1,
		...(defaultProject ? { defaultProject } : {}),
		projects: normalizedProjects,
	};
}

function parseProjectRegistry(content: string): ProjectRegistry | null {
	const registry: ProjectRegistryInput = { projects: [] };
	let currentProject: ParsedProjectEntry | null = null;
	let inProjects = false;
	let seenVersion = false;
	let seenDefaultProject = false;
	let seenProjectsSection = false;

	const finalizeCurrentProject = (): boolean => {
		if (!currentProject) {
			return true;
		}
		if (!currentProject.key) {
			return false;
		}

		registry.projects.push({
			key: currentProject.key,
			path: currentProject.path,
		});
		currentProject = null;
		return true;
	};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}

		if (!inProjects) {
			if (line.startsWith("version:")) {
				if (seenVersion) {
					return null;
				}
				const parsed = splitKeyValue(line);
				if (!parsed) {
					return null;
				}
				const value = parseVersionScalar(parsed[1]);
				if (value === null) {
					return null;
				}
				registry.version = value;
				seenVersion = true;
				continue;
			}

			if (line.startsWith("default_project:") || line.startsWith("defaultProject:")) {
				if (seenDefaultProject) {
					return null;
				}
				const parsed = splitKeyValue(line);
				if (!parsed) {
					return null;
				}
				const value = normalizeProjectKey(parseScalar(parsed[1]));
				if (!value) {
					return null;
				}
				registry.defaultProject = value;
				seenDefaultProject = true;
				continue;
			}

			if (line === "projects: []") {
				if (seenProjectsSection) {
					return null;
				}
				if (!finalizeCurrentProject()) {
					return null;
				}
				seenProjectsSection = true;
				continue;
			}

			if (line === "projects:") {
				if (seenProjectsSection) {
					return null;
				}
				if (!finalizeCurrentProject()) {
					return null;
				}
				inProjects = true;
				seenProjectsSection = true;
				continue;
			}

			return null;
		}

		if (line.startsWith("- ")) {
			if (!finalizeCurrentProject()) {
				return null;
			}
			currentProject = {};
			const parsed = splitKeyValue(line.slice(2).trim());
			if (!parsed) {
				return null;
			}
			const [key, value] = parsed;
			if (key === "key") {
				const parsedKey = parseScalar(value);
				if (!parsedKey) {
					return null;
				}
				currentProject.key = parsedKey;
				currentProject.keySeen = true;
			} else if (key === "path") {
				const parsedPath = parseScalar(value);
				if (!parsedPath) {
					return null;
				}
				currentProject.path = parsedPath;
				currentProject.pathSeen = true;
			} else {
				return null;
			}
			continue;
		}

		if (!currentProject) {
			return null;
		}

		const parsed = splitKeyValue(line);
		if (!parsed) {
			return null;
		}
		const [key, value] = parsed;
		if (key === "key") {
			if (currentProject.keySeen) {
				return null;
			}
			const parsedKey = parseScalar(value);
			if (!parsedKey) {
				return null;
			}
			currentProject.key = parsedKey;
			currentProject.keySeen = true;
			continue;
		}
		if (key === "path") {
			if (currentProject.pathSeen) {
				return null;
			}
			const parsedPath = parseScalar(value);
			if (!parsedPath) {
				return null;
			}
			currentProject.path = parsedPath;
			currentProject.pathSeen = true;
			continue;
		}

		return null;
	}

	if (!finalizeCurrentProject()) {
		return null;
	}
	return normalizeProjectRegistry(registry);
}

async function loadProjectRegistry(projectRoot: string): Promise<ProjectRegistryLoadResult> {
	let invalidPath: string | undefined;
	const candidates = projectRegistryCandidatePaths(projectRoot);

	for (const candidatePath of candidates) {
		try {
			const content = await readFile(candidatePath, "utf8");
			const registry = parseProjectRegistry(content);
			if (registry) {
				return {
					state: "valid",
					registry,
					registryPath: candidatePath,
					containerRoot: dirname(candidatePath),
				};
			}

			invalidPath ??= candidatePath;
		} catch (error) {
			if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
				continue;
			}
			invalidPath ??= candidatePath;
		}
	}

	return invalidPath ? { state: "invalid", path: invalidPath } : { state: "missing" };
}

function serializeProjectRegistry(registry: ProjectRegistry): string {
	const lines = [`version: ${registry.version}`];

	if (registry.defaultProject) {
		lines.push(`default_project: ${JSON.stringify(registry.defaultProject)}`);
	}

	if (registry.projects.length === 0) {
		lines.push("projects: []");
		return `${lines.join("\n")}\n`;
	}

	lines.push("projects:");
	for (const project of registry.projects) {
		lines.push(`  - key: ${JSON.stringify(project.key)}`);
		if (project.path) {
			lines.push(`    path: ${JSON.stringify(project.path)}`);
		}
	}

	return `${lines.join("\n")}\n`;
}

function resolveProjectByCwd(projectRoot: string, registry: ProjectRegistry, cwd: string): ProjectDefinition | null {
	const resolvedCwd = resolve(projectRoot, cwd);
	const relativeCwd = normalize(relative(projectRoot, resolvedCwd)).replace(/\\/g, "/");
	if (!relativeCwd || relativeCwd === "." || relativeCwd.startsWith("..")) {
		return null;
	}

	let selected: ProjectDefinition | null = null;
	let selectedLength = -1;

	for (const project of registry.projects) {
		if (!project.path) {
			continue;
		}

		const projectPath = normalizeProjectBacklogDirectory(project.path);
		if (!projectPath) {
			continue;
		}

		if (relativeCwd !== projectPath && !relativeCwd.startsWith(`${projectPath}/`)) {
			continue;
		}

		if (projectPath.length > selectedLength) {
			selected = project;
			selectedLength = projectPath.length;
		}
	}

	return selected;
}

function findProjectByKey(registry: ProjectRegistry, key: string): ProjectDefinition | null {
	const normalizedKey = normalizeProjectKey(key);
	if (!normalizedKey) {
		return null;
	}

	const lowerKey = normalizedKey.toLowerCase();
	return (
		registry.projects.find((project) => project.key === normalizedKey) ??
		registry.projects.find((project) => project.key.toLowerCase() === lowerKey) ??
		null
	);
}

export async function readProjectRegistry(projectRoot: string): Promise<ProjectRegistry | null> {
	const result = await loadProjectRegistry(projectRoot);
	if (result.state !== "valid") {
		return null;
	}

	return result.registry;
}

export async function writeProjectRegistry(projectRoot: string, registry: ProjectRegistry): Promise<void> {
	const normalized = normalizeProjectRegistry(registry);
	if (!normalized) {
		throw new Error("Invalid project registry.");
	}

	const existingRegistry = await loadProjectRegistry(projectRoot);
	const registryPath =
		existingRegistry.state === "valid" ? existingRegistry.registryPath : projectRegistryPath(projectRoot);
	await mkdir(dirname(registryPath), { recursive: true });
	await writeFile(registryPath, serializeProjectRegistry(normalized), "utf8");
}

export async function resolveProjectContext(
	projectRoot: string,
	options: { cwd?: string; project?: string },
): Promise<ResolvedProjectContext> {
	const registryLoad = await loadProjectRegistry(projectRoot);
	if (registryLoad.state === "missing" || (registryLoad.state === "valid" && registryLoad.registry.projects.length === 0)) {
		throw new Error("No projects are registered in backlog/projects.yml.");
	}
	if (registryLoad.state === "invalid") {
		throw new Error(`${registryLoad.path ?? projectRegistryPath(projectRoot)} exists but is invalid.`);
	}
	const registry = registryLoad.registry;

	const explicitProject = options.project?.trim();
	if (options.project !== undefined && !explicitProject) {
		throw new Error("Unknown project: ");
	}

	if (explicitProject) {
		const match = findProjectByKey(registry, explicitProject);
		if (!match) {
			throw new Error(`Unknown project: ${explicitProject}`);
		}

		return {
			repoRoot: projectRoot,
			containerRoot: registryLoad.containerRoot,
			registryPath: registryLoad.registryPath,
			project: match,
			backlogRoot: join(registryLoad.containerRoot, match.key),
		};
	}

	if (options.cwd) {
		const match = resolveProjectByCwd(projectRoot, registry, options.cwd);
		if (match) {
			return {
				repoRoot: projectRoot,
				containerRoot: registryLoad.containerRoot,
				registryPath: registryLoad.registryPath,
				project: match,
				backlogRoot: join(registryLoad.containerRoot, match.key),
			};
		}
	}

	if (registry.defaultProject) {
		const defaultProject = findProjectByKey(registry, registry.defaultProject);
		if (defaultProject) {
			return {
				repoRoot: projectRoot,
				containerRoot: registryLoad.containerRoot,
				registryPath: registryLoad.registryPath,
				project: defaultProject,
				backlogRoot: join(registryLoad.containerRoot, defaultProject.key),
			};
		}
	}

	throw new Error("Unable to resolve a project from backlog/projects.yml.");
}
