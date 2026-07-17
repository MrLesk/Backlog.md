import { spawn, which } from "bun";

export interface StatusCallbackOptions {
	command: string;
	taskId: string;
	oldStatus: string;
	newStatus: string;
	taskTitle: string;
	cwd: string;
	/** Optional shell override (see BacklogConfig.shell). When omitted, auto-detected for the current platform. */
	shell?: string;
}

export interface StatusCallbackResult {
	success: boolean;
	output?: string;
	error?: string;
	exitCode?: number;
}

export interface ShellResolution {
	/** Arg vector prefix; the user command is appended as the final argument. */
	cmd: string[];
	/** Optional one-time warning the caller should emit on stderr. */
	warning?: string;
}

export interface ShellResolverEnv {
	platform: NodeJS.Platform;
	which: (bin: string) => string | null;
}

const defaultResolverEnv: ShellResolverEnv = {
	platform: process.platform,
	which: (bin) => which(bin) ?? null,
};

function namedShellInvocation(name: string): string[] | null {
	switch (name.toLowerCase()) {
		case "sh":
			return ["sh", "-c"];
		case "bash":
			return ["bash", "-c"];
		case "cmd":
			return ["cmd", "/c"];
		case "pwsh":
			return ["pwsh", "-NoProfile", "-Command"];
		case "powershell":
			return ["powershell", "-NoProfile", "-Command"];
		default:
			return null;
	}
}

/**
 * Canonical list of named shells the resolver knows how to invoke.
 * Exported so the server-side capability probe and the UI dropdown stay in sync.
 */
export const PROBEABLE_SHELLS = ["sh", "bash", "cmd", "pwsh", "powershell"] as const;
export type ProbeableShell = (typeof PROBEABLE_SHELLS)[number];

/**
 * Check which {@link PROBEABLE_SHELLS} are actually on the server's PATH.
 * On Windows, both the bare name and the `.exe` variant are accepted because
 * older Git for Windows installs `sh.exe` without registering `.exe` in PATHEXT
 * for the spawn lookup.
 */
export function probeShellAvailability(env: ShellResolverEnv = defaultResolverEnv): Record<ProbeableShell, boolean> {
	const result = {} as Record<ProbeableShell, boolean>;
	for (const name of PROBEABLE_SHELLS) {
		const found = env.which(name) !== null || (env.platform === "win32" && env.which(`${name}.exe`) !== null);
		result[name] = found;
	}
	return result;
}

/**
 * Resolve which shell + args to use for executing a user-provided status-change command.
 * Exported for testing; production callers should use {@link executeStatusCallback}.
 */
export function resolveShellInvocation(
	configShell?: string,
	env: ShellResolverEnv = defaultResolverEnv,
): ShellResolution {
	const explicit = configShell?.trim();

	if (explicit && explicit.toLowerCase() !== "auto") {
		const named = namedShellInvocation(explicit);
		if (named) return { cmd: named };
		// Treat anything else (absolute path, unknown name) as a POSIX-style interpreter.
		return { cmd: [explicit, "-c"] };
	}

	if (env.platform === "win32") {
		const shPath = env.which("sh") ?? env.which("sh.exe");
		if (shPath) return { cmd: [shPath, "-c"] };
		return {
			cmd: ["cmd", "/c"],
			warning:
				"onStatusChange: sh.exe not found on PATH; falling back to cmd.exe /c. POSIX shell syntax in your command may not work — install Git for Windows (provides sh.exe) or set `shell: pwsh` in backlog.config.yml.",
		};
	}

	return { cmd: ["sh", "-c"] };
}

let warnedOnce = false;

/**
 * Executes a status change callback command with variable injection.
 * Variables are passed as environment variables to the shell command.
 *
 * @param options - The callback options including command and task details
 * @returns The result of the callback execution
 */
export async function executeStatusCallback(options: StatusCallbackOptions): Promise<StatusCallbackResult> {
	const { command, taskId, oldStatus, newStatus, taskTitle, cwd, shell } = options;

	if (!command || command.trim().length === 0) {
		return { success: false, error: "Empty command" };
	}

	// Global kill-switch: skip firing the hook entirely. Lets a user (or the
	// test suite) suppress the dispatch loop without editing config — useful for
	// bulk status edits and required so the default onStatusChange this fork
	// ships doesn't spawn a dispatcher subprocess on every transition in tests.
	if (process.env.BACKLOG_DISABLE_STATUS_HOOKS === "1") {
		return { success: true, output: "skipped (BACKLOG_DISABLE_STATUS_HOOKS=1)" };
	}

	try {
		const env = {
			...process.env,
			TASK_ID: taskId,
			OLD_STATUS: oldStatus,
			NEW_STATUS: newStatus,
			TASK_TITLE: taskTitle,
		};

		const { cmd: shellCmd, warning } = resolveShellInvocation(shell);
		if (warning && !warnedOnce) {
			warnedOnce = true;
			console.warn(warning);
		}

		const proc = spawn({
			cmd: [...shellCmd, command],
			cwd,
			env,
			stdout: "pipe",
			stderr: "pipe",
		});

		const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);

		const exitCode = await proc.exited;
		const success = exitCode === 0;

		const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");

		return {
			success,
			output: output || undefined,
			exitCode,
			...(stderr.trim() && !success && { error: stderr.trim() }),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
