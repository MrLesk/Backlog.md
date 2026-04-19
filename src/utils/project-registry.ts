import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, normalize, relative, resolve } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES } from "../constants/index.ts";
import type { ProjectDefinition, ProjectRegistry, ResolvedProjectContext } from "../types/index.ts";
import { normalizeProjectBacklogDirectory } from "./backlog-directory.ts";

interface ProjectRegistryInput {
	version?: number;
	defaultProject?: string;
	projects: Array<{
		key?: string;
		path?: string;
	}>;
}

function projectRegistryPath(projectRoot: string): string {
	return join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG, DEFAULT_FILES.PROJECT_REGISTRY);
}

function stripQuotes(value: string): string {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
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

	return normalized;
}

function normalizeProjectRegistry(registry: ProjectRegistryInput): ProjectRegistry | null {
	if (registry.version !== 1) {
		return null;
	}

	const normalizedProjects: ProjectDefinition[] = [];
	const seenKeys = new Set<string>();

	for (const project of registry.projects) {
		const key = normalizeProjectKey(project.key);
		if (!key || seenKeys.has(key)) {
			return null;
		}

		seenKeys.add(key);

		if (project.path === undefined) {
			normalizedProjects.push({ key });
			continue;
		}

		const path = normalizeProjectBacklogDirectory(project.path);
		if (!path) {
			return null;
		}

		normalizedProjects.push({ key, path });
	}

	const defaultProject = registry.defaultProject ? normalizeProjectKey(registry.defaultProject) : undefined;
	if (registry.defaultProject && !defaultProject) {
		return null;
	}
	if (defaultProject && !seenKeys.has(defaultProject)) {
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
	let currentProject: ProjectRegistryInput["projects"][number] | null = null;
	let inProjects = false;

	const pushCurrentProject = (): void => {
		if (currentProject) {
			registry.projects.push(currentProject);
			currentProject = null;
		}
	};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}

		if (line.startsWith("version:")) {
			const parsed = splitKeyValue(line);
			if (!parsed) {
				return null;
			}
			const value = Number.parseInt(stripQuotes(parsed[1]), 10);
			if (!Number.isInteger(value)) {
				return null;
			}
			registry.version = value;
			continue;
		}

		if (line.startsWith("default_project:") || line.startsWith("defaultProject:")) {
			const parsed = splitKeyValue(line);
			if (!parsed) {
				return null;
			}
			const value = normalizeProjectKey(stripQuotes(parsed[1]));
			if (!value) {
				return null;
			}
			registry.defaultProject = value;
			continue;
		}

		if (line === "projects: []") {
			pushCurrentProject();
			inProjects = false;
			continue;
		}

		if (line === "projects:") {
			pushCurrentProject();
			inProjects = true;
			continue;
		}

		if (!inProjects) {
			continue;
		}

		if (line.startsWith("- ")) {
			pushCurrentProject();
			currentProject = {};
			const parsed = splitKeyValue(line.slice(2).trim());
			if (!parsed) {
				return null;
			}
			const [key, value] = parsed;
			if (key === "key") {
				currentProject.key = stripQuotes(value);
			} else if (key === "path") {
				currentProject.path = stripQuotes(value);
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
			currentProject.key = stripQuotes(value);
			continue;
		}
		if (key === "path") {
			currentProject.path = stripQuotes(value);
			continue;
		}

		return null;
	}

	pushCurrentProject();
	return normalizeProjectRegistry(registry);
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

function buildResolvedProjectContext(projectRoot: string, project: ProjectDefinition): ResolvedProjectContext {
	const containerRoot = join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
	return {
		repoRoot: projectRoot,
		containerRoot,
		registryPath: projectRegistryPath(projectRoot),
		project,
		backlogRoot: join(containerRoot, project.key),
	};
}

export async function readProjectRegistry(projectRoot: string): Promise<ProjectRegistry | null> {
	try {
		const content = await readFile(projectRegistryPath(projectRoot), "utf8");
		return parseProjectRegistry(content);
	} catch {
		return null;
	}
}

export async function writeProjectRegistry(projectRoot: string, registry: ProjectRegistry): Promise<void> {
	const normalized = normalizeProjectRegistry(registry);
	if (!normalized) {
		throw new Error("Invalid project registry.");
	}

	await mkdir(join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG), { recursive: true });
	await writeFile(projectRegistryPath(projectRoot), serializeProjectRegistry(normalized), "utf8");
}

export async function resolveProjectContext(
	projectRoot: string,
	options: { cwd?: string; project?: string },
): Promise<ResolvedProjectContext> {
	const registry = await readProjectRegistry(projectRoot);
	if (!registry || registry.projects.length === 0) {
		throw new Error("No projects are registered in backlog/projects.yml.");
	}

	const explicitProject = options.project?.trim();
	if (options.project !== undefined && !explicitProject) {
		throw new Error("Unknown project: ");
	}

	if (explicitProject) {
		const match = registry.projects.find((project) => project.key === explicitProject);
		if (!match) {
			throw new Error(`Unknown project: ${explicitProject}`);
		}

		return buildResolvedProjectContext(projectRoot, match);
	}

	if (options.cwd) {
		const match = resolveProjectByCwd(projectRoot, registry, options.cwd);
		if (match) {
			return buildResolvedProjectContext(projectRoot, match);
		}
	}

	if (registry.defaultProject) {
		const defaultProject = registry.projects.find((project) => project.key === registry.defaultProject);
		if (defaultProject) {
			return buildResolvedProjectContext(projectRoot, defaultProject);
		}
	}

	throw new Error("Unable to resolve a project from backlog/projects.yml.");
}
