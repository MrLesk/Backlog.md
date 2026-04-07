import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import type { BacklogConfig } from "../types/index.ts";

/**
 * GitButler virtual branch representation
 */
export interface VirtualBranch {
	name: string;
	state: "applied" | "unapplied";
	refname?: string;
}

/**
 * GitButler CLI operations wrapper
 */
export class GitButlerOperations {
	private projectRoot: string;
	private config: BacklogConfig | null = null;

	constructor(projectRoot: string, config: BacklogConfig | null = null) {
		this.projectRoot = projectRoot;
		this.config = config;
	}

	setConfig(config: BacklogConfig | null): void {
		this.config = config;
	}

	/**
	 * Check if GitButler is available in this repository
	 */
	static async isAvailable(projectRoot: string): Promise<boolean> {
		// Check for .gitbutler directory (created by GitButler)
		const gitbutlerDir = join(projectRoot, ".gitbutler");
		if (!existsSync(gitbutlerDir)) {
			return false;
		}

		// Check if but CLI is available
		try {
			await $`but --version`.cwd(projectRoot).quiet();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Execute a GitButler CLI command
	 */
	private async execButler(
		args: string[],
		options?: { readOnly?: boolean; cwd?: string },
	): Promise<{ stdout: string; stderr: string }> {
		const env = options?.readOnly
			? ({ ...process.env, GIT_OPTIONAL_LOCKS: "0" } as Record<string, string>)
			: (process.env as Record<string, string>);

		const subprocess = Bun.spawn(["but", ...args], {
			cwd: options?.cwd ?? this.projectRoot,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			env,
		});

		const stdoutPromise = subprocess.stdout ? new Response(subprocess.stdout).text() : Promise.resolve("");
		const stderrPromise = subprocess.stderr ? new Response(subprocess.stderr).text() : Promise.resolve("");
		const [exitCode, stdout, stderr] = await Promise.all([subprocess.exited, stdoutPromise, stderrPromise]);

		if (exitCode !== 0) {
			throw new Error(`GitButler command failed (exit code ${exitCode}): but ${args.join(" ")}\n${stderr}`);
		}

		return { stdout, stderr };
	}

	/**
	 * List all virtual branches
	 */
	async listBranches(): Promise<VirtualBranch[]> {
		const { stdout } = await this.execButler(["branch", "list", "--json"], { readOnly: true });

		try {
			const data = JSON.parse(stdout);
			return (data.branches ?? []).map((b: { name: string; applied: boolean; refname?: string }) => ({
				name: b.name,
				state: b.applied ? "applied" : "unapplied",
				refname: b.refname,
			}));
		} catch {
			// Fallback: parse text output
			const branches: VirtualBranch[] = [];
			const lines = stdout.split("\n").filter(Boolean);
			for (const line of lines) {
				const match = line.match(/^([^\s]+)\s+\((applied|unapplied)\)/);
				if (match) {
					branches.push({ name: match[1], state: match[2] as "applied" | "unapplied" });
				}
			}
			return branches;
		}
	}

	/**
	 * Get current status of GitButler
	 */
	async getStatus(): Promise<string> {
		const { stdout } = await this.execButler(["status", "--json"], { readOnly: true });
		return stdout;
	}

	/**
	 * Apply a virtual branch (make it active in the working tree)
	 */
	async applyBranch(branchName: string): Promise<void> {
		await this.execButler(["branch", "apply", branchName]);
	}

	/**
	 * Unapply a virtual branch (remove from working tree)
	 */
	async unapplyBranch(branchName: string): Promise<void> {
		await this.execButler(["branch", "unapply", branchName]);
	}

	/**
	 * Create a new virtual branch
	 */
	async createBranch(name: string, base?: string): Promise<void> {
		const args = ["branch", "create", name];
		if (base) {
			args.push("--base", base);
		}
		await this.execButler(args);
	}

	/**
	 * Stage files for commit
	 */
	async stageFiles(_filePaths: string[]): Promise<void> {
		// Use 'but add .' to stage all changes in the working directory
		// This avoids CLI argument limits and special character issues with individual file paths
		await this.execButler(["add", "."]);
	}

	/**
	 * Commit staged changes in GitButler
	 */
	async commit(message: string): Promise<void> {
		const args = ["commit", "-m", message];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execButler(args);
	}

	/**
	 * Check if working tree is clean
	 */
	async isClean(): Promise<boolean> {
		const { stdout } = await this.execButler(["status", "--json"], { readOnly: true });
		try {
			const data = JSON.parse(stdout);
			return (data.clean ?? true) && (data.tracked ?? []).length === 0;
		} catch {
			return stdout.trim() === "" || stdout.includes("clean");
		}
	}

	/**
	 * Get current branch (virtual or regular)
	 */
	async getCurrentBranch(): Promise<string> {
		const { stdout } = await this.execButler(["branch", "current"], { readOnly: true });
		return stdout.trim() || "main";
	}
}

/**
 * Helper to detect GitButler availability
 */
export async function detectGitButler(projectRoot: string): Promise<boolean> {
	return GitButlerOperations.isAvailable(projectRoot);
}
