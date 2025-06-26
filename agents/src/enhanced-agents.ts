import { type ChildProcess, spawn } from "node:child_process";
import type { AgentProcess, AgentResponse } from "./types.ts";

export class EnhancedAgentManager {
	private agents: Map<string, AgentProcess> = new Map();
	private conversationPipes: Map<string, string> = new Map();

	async startAgent(name: "claude" | "gemini" | "codex"): Promise<boolean> {
		try {
			// Create named pipe for this agent
			const pipePath = `/tmp/agents-${name}-${Date.now()}`;
			this.conversationPipes.set(name, pipePath);

			let process: ChildProcess;

			if (name === "claude") {
				// For Claude, we'll use the existing claude CLI in interactive mode
				process = spawn("claude", ["--interactive"], {
					stdio: ["pipe", "pipe", "pipe"],
					shell: true,
				});
			} else if (name === "gemini") {
				// For Gemini, use the gemini CLI
				// We'll create a wrapper script that maintains conversation context
				const geminiWrapper = this.createGeminiWrapper(pipePath);
				process = spawn("bash", ["-c", geminiWrapper], {
					stdio: ["pipe", "pipe", "pipe"],
					shell: true,
				});
			} else if (name === "codex") {
				// For Codex, use the codex CLI
				const codexWrapper = this.createCodexWrapper(pipePath);
				process = spawn("bash", ["-c", codexWrapper], {
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
			process.on("exit", (code) => {
				agentProcess.isAlive = false;
				console.log(`🔴 ${name} agent disconnected (code: ${code})`);
				this.cleanup(name);
			});

			process.on("error", (error) => {
				console.error(`❌ ${name} agent error:`, error.message);
				agentProcess.isAlive = false;
				this.cleanup(name);
			});

			this.agents.set(name, agentProcess);
			console.log(`🟢 ${name} agent started`);

			// Wait a moment for the process to initialize
			await new Promise((resolve) => setTimeout(resolve, 1000));

			return true;
		} catch (error) {
			console.error(`Failed to start ${name} agent:`, error);
			this.cleanup(name);
			return false;
		}
	}

	private createGeminiWrapper(pipePath: string): string {
		return `
#!/bin/bash
CONVERSATION_LOG="/tmp/gemini_conversation_\${RANDOM}.log"
echo "=== Multi-Agent Conversation Started ===" > "\$CONVERSATION_LOG"

function send_to_gemini() {
	local new_message="\$1"
	echo -e "\\nUser/System: \$new_message" >> "\$CONVERSATION_LOG"
	
	# Get full context and send to gemini
	FULL_CONTEXT=\$(cat "\$CONVERSATION_LOG")
	RESPONSE=\$(echo "\$FULL_CONTEXT" | gemini -p "Please continue this multi-agent conversation. You are Gemini working alongside Claude and potentially Codex. Build on the conversation context and respond naturally to the most recent message:")
	
	echo -e "\\nGemini: \$RESPONSE" >> "\$CONVERSATION_LOG"
	echo "\$RESPONSE"
}

# Read from stdin and process each line
while IFS= read -r line; do
	if [[ "\$line" == "EXIT_AGENT" ]]; then
		break
	fi
	send_to_gemini "\$line"
done
`;
	}

	private createCodexWrapper(pipePath: string): string {
		return `
#!/bin/bash
CONVERSATION_LOG="/tmp/codex_conversation_\${RANDOM}.log"
echo "=== Multi-Agent Conversation Started ===" > "\$CONVERSATION_LOG"

function send_to_codex() {
	local new_message="\$1"
	echo -e "\\nUser/System: \$new_message" >> "\$CONVERSATION_LOG"
	
	# Get full context and send to codex
	FULL_CONTEXT=\$(cat "\$CONVERSATION_LOG")
	RESPONSE=\$(echo "\$FULL_CONTEXT" | codex -p "Please continue this multi-agent conversation. You are Codex working alongside Claude and Gemini. Focus on technical and coding insights. Build on the conversation context and respond naturally to the most recent message:")
	
	echo -e "\\nCodex: \$RESPONSE" >> "\$CONVERSATION_LOG"
	echo "\$RESPONSE"
}

# Read from stdin and process each line
while IFS= read -r line; do
	if [[ "\$line" == "EXIT_AGENT" ]]; then
		break
	fi
	send_to_codex "\$line"
done
`;
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
			let errorBuffer = "";
			let timeout: Timer;
			let hasResolved = false;

			const resolveOnce = (response: AgentResponse) => {
				if (!hasResolved) {
					hasResolved = true;
					clearTimeout(timeout);
					resolve(response);
				}
			};

			// Set up response timeout
			timeout = setTimeout(() => {
				resolveOnce({
					agent: agentName,
					content: responseBuffer.trim() || "No response received",
					error: "Response timeout (30s)",
				});
			}, 30000);

			// Handle stdout data
			const onData = (data: Buffer) => {
				const chunk = data.toString();
				responseBuffer += chunk;
				agent.lastResponse = Date.now();

				// For some CLIs, we might get the full response in chunks
				// We'll wait for a natural break or the stream to end
			};

			// Handle stderr data
			const onError = (data: Buffer) => {
				const errorText = data.toString();
				if (errorText.trim()) {
					errorBuffer += errorText;
				}
			};

			// Handle when the stream indicates it's done
			const onEnd = () => {
				resolveOnce({
					agent: agentName,
					content: responseBuffer.trim(),
					error: errorBuffer.trim() || undefined,
				});
			};

			// Set up temporary listeners
			agent.process.stdout?.on("data", onData);
			agent.process.stderr?.on("data", onError);

			// For interactive CLIs, we need a different approach
			// We'll send the message and wait for a reasonable response time
			const sendAndWait = async () => {
				try {
					agent.process.stdin?.write(`${message}\n`);

					// Wait for initial response
					await new Promise((resolve) => setTimeout(resolve, 3000));

					// If we have a substantial response, resolve
					if (responseBuffer.trim().length > 10) {
						resolveOnce({
							agent: agentName,
							content: responseBuffer.trim(),
							error: errorBuffer.trim() || undefined,
						});
					} else {
						// Wait a bit more for slower responses
						await new Promise((resolve) => setTimeout(resolve, 5000));
						resolveOnce({
							agent: agentName,
							content:
								responseBuffer.trim() || "Agent did not provide a response",
							error: errorBuffer.trim() || undefined,
						});
					}
				} catch (error) {
					resolveOnce({
						agent: agentName,
						content: "",
						error: `Failed to send message: ${error}`,
					});
				} finally {
					// Clean up listeners
					agent.process.stdout?.off("data", onData);
					agent.process.stderr?.off("data", onError);
				}
			};

			sendAndWait();
		});
	}

	stopAgent(agentName: string): void {
		const agent = this.agents.get(agentName);
		if (agent && agent.isAlive) {
			try {
				// Send exit signal for graceful shutdown
				agent.process.stdin?.write("EXIT_AGENT\n");
				agent.process.stdin?.end();

				// Force kill after a delay if still running
				setTimeout(() => {
					if (agent.isAlive) {
						agent.process.kill("SIGTERM");
					}
				}, 2000);
			} catch (error) {
				// Force kill if graceful shutdown fails
				agent.process.kill("SIGKILL");
			}

			this.cleanup(agentName);
		}
	}

	private cleanup(agentName: string): void {
		const agent = this.agents.get(agentName);
		if (agent) {
			agent.isAlive = false;
			this.agents.delete(agentName);
		}

		// Clean up pipe if it exists
		const pipePath = this.conversationPipes.get(agentName);
		if (pipePath) {
			try {
				// Remove the pipe file
				Bun.spawn(["rm", "-f", pipePath]);
			} catch (error) {
				// Ignore cleanup errors
			}
			this.conversationPipes.delete(agentName);
		}

		console.log(`🔴 ${agentName} agent stopped and cleaned up`);
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

	getAgentStats(): Record<string, { alive: boolean; lastResponse?: number }> {
		const stats: Record<string, { alive: boolean; lastResponse?: number }> = {};

		for (const [name, agent] of this.agents) {
			stats[name] = {
				alive: agent.isAlive,
				lastResponse: agent.lastResponse,
			};
		}

		return stats;
	}
}
