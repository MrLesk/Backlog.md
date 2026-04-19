import { resolveProjectContext } from "../utils/project-registry.ts";
import { Core } from "./backlog.ts";

export class ProjectManager {
	private readonly cores = new Map<string, Core>();

	constructor(private readonly projectRoot: string) {}

	async getCore(options: { project?: string; cwd?: string; enableWatchers?: boolean }): Promise<Core> {
		const context = await resolveProjectContext(this.projectRoot, options);
		const cached = this.cores.get(context.project.key);
		if (cached) {
			return cached;
		}

		const core = new Core(context.repoRoot, {
			enableWatchers: options.enableWatchers,
			backlogRoot: context.backlogRoot,
		});
		this.cores.set(context.project.key, core);
		return core;
	}
}
