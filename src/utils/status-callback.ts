import { spawn } from "bun";

export interface StatusCallbackOptions {
	command: string;
	taskId: string;
	oldStatus: string;
	newStatus: string;
	taskTitle: string;
	cwd: string;
}

export interface StatusCallbackResult {
	success: boolean;
	output?: string;
	error?: string;
	exitCode?: number;
}

/**
 * Executes a status change callback command with variable injection.
 * Variables are passed as environment variables to the shell command.
 *
 * @param options - The callback options including command and task details
 * @returns The result of the callback execution
 */
export async function executeStatusCallback(options: StatusCallbackOptions): Promise<StatusCallbackResult> {
	const { command, taskId, oldStatus, newStatus, taskTitle, cwd } = options;

	if (!command || command.trim().length === 0) {
		return { success: false, error: "Empty command" };
	}

	try {
		const env = {
			...process.env,
			TASK_ID: taskId,
			OLD_STATUS: oldStatus,
			NEW_STATUS: newStatus,
			TASK_TITLE: taskTitle,
		};

		const proc = spawn({
			cmd: ["sh", "-c", command],
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
