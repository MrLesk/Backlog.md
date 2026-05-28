import { mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * A resolved reference to a remote GitHub (or other git host) repository whose
 * `backlog/` folder we want to render locally. Produced by {@link parseRemoteSpec}.
 */
export interface RemoteRepoSpec {
	/** Host portion, e.g. "github.com". Defaults to github.com for the owner/name shorthand. */
	host: string;
	/** Repository owner / org. */
	owner: string;
	/** Repository name (without trailing .git). */
	name: string;
	/** Optional branch, tag, or commit to check out. Undefined means the repo default branch. */
	ref?: string;
	/** The URL passed to `git clone`. */
	cloneUrl: string;
	/** Human-friendly label like "owner/name" or "owner/name@ref". */
	label: string;
}

const BACKLOG_REMOTE_CACHE_ENV = "BACKLOG_REMOTE_CACHE";

// owner/name shorthand: letters, digits, dot, dash, underscore in each segment.
const SHORTHAND_RE = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/;
// https://host/owner/name(.git) with optional auth + trailing slash.
const HTTP_RE = /^https?:\/\/(?:[^@/]+@)?([^/]+)\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
// scp-like ssh: git@host:owner/name(.git)
const SSH_RE = /^[\w.-]+@([^:]+):([\w.-]+)\/([\w.-]+?)(?:\.git)?$/;

function buildLabel(owner: string, name: string, ref?: string): string {
	return ref ? `${owner}/${name}@${ref}` : `${owner}/${name}`;
}

/**
 * Parse a user-supplied repo reference into a {@link RemoteRepoSpec}.
 *
 * Accepts:
 *   - `owner/name`            (shorthand, assumes github.com over https)
 *   - `https://github.com/owner/name` (optionally `.git`, optional auth, trailing slash)
 *   - `git@github.com:owner/name.git` (scp-style ssh)
 *
 * `ref` is an optional branch/tag/commit (from `--ref`). Throws on unrecognized input.
 */
export function parseRemoteSpec(input: string, ref?: string): RemoteRepoSpec {
	const raw = input.trim();
	const cleanRef = ref?.trim() || undefined;
	if (!raw) {
		throw new Error("Empty repository reference. Use owner/name or a clone URL.");
	}

	const ssh = raw.match(SSH_RE);
	if (ssh) {
		const [, host, owner, name] = ssh as unknown as [string, string, string, string];
		return { host, owner, name, ref: cleanRef, cloneUrl: raw, label: buildLabel(owner, name, cleanRef) };
	}

	const http = raw.match(HTTP_RE);
	if (http) {
		const [, host, owner, name] = http as unknown as [string, string, string, string];
		// Normalize to a .git URL so credential helpers behave consistently.
		const cloneUrl = `https://${host}/${owner}/${name}.git`;
		return { host, owner, name, ref: cleanRef, cloneUrl, label: buildLabel(owner, name, cleanRef) };
	}

	const shorthand = raw.match(SHORTHAND_RE);
	if (shorthand) {
		const [, owner, name] = shorthand as unknown as [string, string, string];
		const host = "github.com";
		const cloneUrl = `https://${host}/${owner}/${name}.git`;
		return { host, owner, name, ref: cleanRef, cloneUrl, label: buildLabel(owner, name, cleanRef) };
	}

	throw new Error(
		`Could not parse repository reference "${input}". Use owner/name, https://host/owner/name, or git@host:owner/name.git.`,
	);
}

/**
 * Local cache directory for a remote repo's working copy.
 * `~/.backlog/remotes/<host>/<owner>/<name>`, or under `$BACKLOG_REMOTE_CACHE` when set.
 */
export function getRemoteCacheDir(spec: RemoteRepoSpec): string {
	const base = process.env[BACKLOG_REMOTE_CACHE_ENV]?.trim() || join(homedir(), ".backlog", "remotes");
	return join(base, spec.host, spec.owner, spec.name);
}

async function runGit(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	// Mirror src/git/operations.ts execGit: explicit stdio to avoid Windows / MCP stdin deadlocks.
	const subprocess = Bun.spawn(["git", ...args], {
		cwd,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } as Record<string, string>,
	});
	const stdoutPromise = subprocess.stdout ? new Response(subprocess.stdout).text() : Promise.resolve("");
	const stderrPromise = subprocess.stderr ? new Response(subprocess.stderr).text() : Promise.resolve("");
	const [exitCode, stdout, stderr] = await Promise.all([subprocess.exited, stdoutPromise, stderrPromise]);
	return { stdout, stderr, exitCode };
}

async function git(args: string[], cwd?: string): Promise<string> {
	const { stdout, stderr, exitCode } = await runGit(args, cwd);
	if (exitCode !== 0) {
		throw new Error(`git ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`);
	}
	return stdout;
}

async function isDir(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function isGitRepo(path: string): Promise<boolean> {
	if (!(await isDir(path))) return false;
	const { exitCode } = await runGit(["rev-parse", "--git-dir"], path);
	return exitCode === 0;
}

async function currentBranch(cacheDir: string): Promise<string | undefined> {
	try {
		const out = (await git(["rev-parse", "--abbrev-ref", "HEAD"], cacheDir)).trim();
		return out && out !== "HEAD" ? out : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Ensure a local working copy of `spec` exists in the cache and is up to date,
 * checking out only the `backlog/` folder (sparse). Returns the cache directory
 * (the project root to hand to Core).
 *
 * - First time: shallow + blobless + sparse clone, then `sparse-checkout set backlog`.
 * - Subsequent runs (refresh): fetch the target ref and hard-reset to it.
 * - `cacheDir` override is mainly for tests; production uses {@link getRemoteCacheDir}.
 */
export async function ensureRemoteRepo(
	spec: RemoteRepoSpec,
	options?: { refresh?: boolean; cacheDir?: string },
): Promise<string> {
	const cacheDir = options?.cacheDir ?? getRemoteCacheDir(spec);
	const refresh = options?.refresh !== false;
	const alreadyCloned = await isGitRepo(cacheDir);

	if (!alreadyCloned) {
		// A stale/partial cache dir (exists but isn't a git repo) would make `git clone` refuse.
		// It's our own cache, so clear it and let clone recreate it cleanly.
		if (await isDir(cacheDir)) {
			await rm(cacheDir, { recursive: true, force: true });
		}
		await mkdir(dirname(cacheDir), { recursive: true });
		const cloneArgs = ["clone", "--depth", "1", "--filter=blob:none", "--sparse"];
		if (spec.ref) cloneArgs.push("--branch", spec.ref);
		cloneArgs.push(spec.cloneUrl, cacheDir);

		const cloneResult = await runGit(cloneArgs);
		if (cloneResult.exitCode !== 0) {
			// --branch only accepts a branch/tag. If a commit SHA was given (or branch resolution
			// failed), fall back to a default-branch clone and fetch the ref explicitly.
			if (spec.ref) {
				await git(["clone", "--filter=blob:none", "--sparse", spec.cloneUrl, cacheDir]);
				await git(["sparse-checkout", "set", "backlog"], cacheDir);
				await git(["fetch", "origin", spec.ref], cacheDir);
				await git(["checkout", spec.ref], cacheDir);
				return cacheDir;
			}
			throw new Error(`Failed to clone ${spec.cloneUrl}: ${cloneResult.stderr.trim() || cloneResult.stdout.trim()}`);
		}
		await git(["sparse-checkout", "set", "backlog"], cacheDir);
		return cacheDir;
	}

	if (refresh) {
		const ref = spec.ref ?? (await currentBranch(cacheDir)) ?? "HEAD";
		try {
			await git(["fetch", "--depth", "1", "origin", ref], cacheDir);
			await git(["reset", "--hard", "FETCH_HEAD"], cacheDir);
			// Re-assert sparse scope (idempotent; cheap).
			await git(["sparse-checkout", "set", "backlog"], cacheDir);
		} catch {
			// Network/ref hiccup: fall back to the existing cached snapshot rather than failing the view.
		}
	}

	return cacheDir;
}
