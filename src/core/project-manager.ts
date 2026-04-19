import { resolveProjectContext } from "../utils/project-registry.ts";
import { Core } from "./backlog.ts";

export class ProjectManager {
	private readonly cores = new Map<string, Core>();

	constructor(private readonly projectRoot: string) {}

	async getCore(options: { project?: string; cwd?: string; enableWatchers?: boolean }): Promise<Core> {
		const context = await resolveProjectContext(this.projectRoot, options);
		const cacheKey = this.getCacheKey(context.project.key, options.enableWatchers);
		const cached = this.cores.get(cacheKey);
		if (cached) {
			return cached;
		}

		const core = new Core(context.repoRoot, {
			enableWatchers: options.enableWatchers,
			backlogRoot: context.backlogRoot,
		});
		this.cores.set(cacheKey, core);
		return core;
	}

	private getCacheKey(projectKey: string, enableWatchers?: boolean): string {
		return `${projectKey}:${enableWatchers ? "watchers" : "no-watchers"}`;
	}
}
