import { type ChildProcess, spawn } from "node:child_process";
import type { AgentProcess, AgentResponse } from "./types.ts";

export class AgentManager {
	private agents: Map<string, AgentProcess> = new Map();

	async startAgent(name: "claude" | "gemini" | "codex"): Promise<boolean> {
		try {
			let process: ChildProcess;

			if (name === "claude") {
				// Start Claude Code CLI
				process = spawn("claude", [], {
					stdio: ["pipe", "pipe", "pipe"],
					shell: true,
				});
			} else if (name === "gemini") {
				// Start Gemini CLI
				process = spawn("gemini", [], {
					stdio: ["pipe", "pipe", "pipe"],
					shell: true,
				});
			} else if (name === "codex") {
				// Start OpenAI Codex CLI (if available)
				process = spawn("codex", [], {
					stdio: ["pipe", "pipe", "pipe"],
					shell: true,
				});
			}

			const agentProcess: AgentProcess = {
				name,
				process,
				isAlive: true,
				lastResponse: Date.now(),
			};

			// Handle process events
			process.on("exit", () => {
				agentProcess.isAlive = false;
				console.log(`🔴 ${name} agent disconnected`);
			});

			process.on("error", (error) => {
				console.error(`❌ ${name} agent error:`, error.message);
				agentProcess.isAlive = false;
			});

			this.agents.set(name, agentProcess);
			console.log(`🟢 ${name} agent started`);
			return true;
		} catch (error) {
			console.error(`Failed to start ${name} agent:`, error);
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

		return new Promise((resolve) => {
			let responseBuffer = "";
			let timeout: Timer;

			// Set up response timeout
			timeout = setTimeout(() => {
				resolve({
					agent: agentName,
					content: responseBuffer || "",
					error: "Response timeout",
				});
			}, 30000); // 30 second timeout

			// Handle stdout data
			const onData = (data: Buffer) => {
				responseBuffer += data.toString();
				agent.lastResponse = Date.now();
			};

			// Handle stderr data
			const onError = (data: Buffer) => {
				const errorText = data.toString();
				if (errorText.trim()) {
					responseBuffer += `[ERROR] ${errorText}`;
				}
			};

			// Handle process end
			const onEnd = () => {
				clearTimeout(timeout);
				agent.process.stdout?.off("data", onData);
				agent.process.stderr?.off("data", onError);
				agent.process.stdout?.off("end", onEnd);

				resolve({
					agent: agentName,
					content: responseBuffer.trim(),
					error: responseBuffer.includes("[ERROR]")
						? "Agent returned errors"
						: undefined,
				});
			};

			// Set up listeners
			agent.process.stdout?.on("data", onData);
			agent.process.stderr?.on("data", onError);
			agent.process.stdout?.on("end", onEnd);

			// Send the message
			try {
				agent.process.stdin?.write(`${message}\n`);
			} catch (error) {
				clearTimeout(timeout);
				resolve({
					agent: agentName,
					content: "",
					error: `Failed to send message: ${error}`,
				});
			}
		});
	}

	stopAgent(agentName: string): void {
		const agent = this.agents.get(agentName);
		if (agent && agent.isAlive) {
			agent.process.kill();
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
