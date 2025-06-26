import { type ChildProcess, spawn } from "node:child_process";
import type { AgentProcess, AgentResponse } from "./types.ts";

export class SimpleAgentManager {
	private agents: Map<string, AgentProcess> = new Map();

	async startAgent(name: "claude" | "gemini" | "codex"): Promise<boolean> {
		try {
			console.log(`🔄 Starting ${name} agent...`);

			// For now, we'll use a simpler approach that works with the existing CLIs
			// Each agent will be spawned fresh for each message to avoid hanging processes

			const mockProcess: any = {
				kill: () => {},
				on: () => {},
				stdin: null,
				stdout: null,
				stderr: null,
			};

			const agentProcess: AgentProcess = {
				name,
				process: mockProcess,
				isAlive: true,
				lastResponse: Date.now(),
			};

			this.agents.set(name, agentProcess);
			console.log(`✅ ${name} agent ready`);
			return true;
		} catch (error) {
			console.error(`❌ Failed to start ${name} agent:`, error);
			return false;
		}
	}

	async sendMessage(
		agentName: string,
		message: string,
	): Promise<AgentResponse> {
		const agent = this.agents.get(agentName);
		if (!agent || !agent.isAlive) {
			return {
				agent: agentName,
				content: "",
				error: `${agentName} agent is not available`,
			};
		}

		try {
			// Spawn a fresh process for each message to avoid hanging
			let command: string;
			let args: string[];

			if (agentName === "claude") {
				command = "claude";
				args = [message];
			} else if (agentName === "gemini") {
				command = "gemini";
				args = [message];
			} else if (agentName === "codex") {
				command = "codex";
				args = [message];
			} else {
				throw new Error(`Unknown agent: ${agentName}`);
			}

			return new Promise((resolve) => {
				const process = spawn(command, args, {
					stdio: ["pipe", "pipe", "pipe"],
					shell: true,
				});

				let responseBuffer = "";
				let errorBuffer = "";
				let resolved = false;

				const resolveOnce = (response: AgentResponse) => {
					if (!resolved) {
						resolved = true;
						resolve(response);
					}
				};

				// Set timeout for the response
				const timeout = setTimeout(() => {
					process.kill();
					resolveOnce({
						agent: agentName,
						content:
							responseBuffer.trim() ||
							`${agentName} did not respond within 15 seconds`,
						error: "Response timeout",
					});
				}, 15000); // 15 second timeout

				// Collect stdout
				process.stdout?.on("data", (data) => {
					responseBuffer += data.toString();
				});

				// Collect stderr
				process.stderr?.on("data", (data) => {
					errorBuffer += data.toString();
				});

				// Handle process completion
				process.on("close", (code) => {
					clearTimeout(timeout);
					agent.lastResponse = Date.now();

					resolveOnce({
						agent: agentName,
						content:
							responseBuffer.trim() || `${agentName} completed with no output`,
						error:
							errorBuffer.trim() ||
							(code !== 0 ? `Process exited with code ${code}` : undefined),
					});
				});

				process.on("error", (error) => {
					clearTimeout(timeout);
					resolveOnce({
						agent: agentName,
						content: "",
						error: `Failed to spawn ${agentName}: ${error.message}`,
					});
				});

				// Send the message to stdin if the agent expects it
				if (process.stdin) {
					try {
						process.stdin.write(message);
						process.stdin.end();
					} catch (err) {
						// Some CLIs don't use stdin, that's okay
					}
				}
			});
		} catch (error) {
			return {
				agent: agentName,
				content: "",
				error: `Error sending message to ${agentName}: ${error}`,
			};
		}
	}

	stopAgent(agentName: string): void {
		const agent = this.agents.get(agentName);
		if (agent) {
			agent.isAlive = false;
			this.agents.delete(agentName);
			console.log(`🔴 ${agentName} agent stopped`);
		}
	}

	stopAllAgents(): void {
		for (const agentName of this.agents.keys()) {
			this.stopAgent(agentName);
		}
	}

	getActiveAgents(): string[] {
		return Array.from(this.agents.keys()).filter(
			(name) => this.agents.get(name)?.isAlive,
		);
	}

	isAgentAlive(agentName: string): boolean {
		const agent = this.agents.get(agentName);
		return agent?.isAlive ?? false;
	}
}
