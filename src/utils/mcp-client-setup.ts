import { spawn } from "bun";

export type McpClientSetupKey = "claude" | "codex" | "gemini" | "kiro";

export type McpClientSetupCommand = {
	label: string;
	command: string;
	args: string[];
};

export type McpClientSetupStdio = "inherit" | "pipe";

export function isMcpClientSetupKey(client: string): client is McpClientSetupKey {
	return client === "claude" || client === "codex" || client === "gemini" || client === "kiro";
}

export function getMcpClientSetupCommand(client: McpClientSetupKey, serverName: string): McpClientSetupCommand {
	switch (client) {
		case "claude":
			return {
				label: "Claude Code",
				command: "claude",
				args: ["mcp", "add", "-s", "user", serverName, "--", "backlog", "mcp", "start"],
			};
		case "codex":
			return {
				label: "OpenAI Codex",
				command: "codex",
				args: ["mcp", "add", serverName, "--", "backlog", "mcp", "start"],
			};
		case "gemini":
			return {
				label: "Gemini CLI",
				command: "gemini",
				args: ["mcp", "add", "-s", "user", serverName, "backlog", "mcp", "start"],
			};
		case "kiro":
			return {
				label: "Kiro",
				command: "kiro-cli",
				args: ["mcp", "add", "--scope", "global", "--name", serverName, "--command", "backlog", "--args", "mcp,start"],
			};
	}
}

export function formatMcpClientSetupCommand(command: string, args: string[]): string {
	return [command, ...args].join(" ");
}

export async function runMcpClientSetupCommand(
	command: string,
	args: string[],
	options: { stdout?: McpClientSetupStdio; stderr?: McpClientSetupStdio } = {},
): Promise<void> {
	const stdout = options.stdout ?? "pipe";
	const stderr = options.stderr ?? "pipe";
	const child = spawn({
		cmd: [command, ...args],
		stdout,
		stderr,
	});

	const stdoutText = stdout === "pipe" && child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
	const stderrText = stderr === "pipe" && child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
	const [exitCode, capturedStdout, capturedStderr] = await Promise.all([child.exited, stdoutText, stderrText]);

	if (exitCode !== 0) {
		const details = [capturedStderr.trim(), capturedStdout.trim()].filter(Boolean).join("\n");
		throw new Error(`Command exited with code ${exitCode}${details ? `: ${details}` : ""}`);
	}
}
