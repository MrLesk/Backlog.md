#!/usr/bin/env bun

import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { ConversationManager } from "./conversation.ts";
import { StreamingAgentManager } from "./streaming-agents.ts";

const program = new Command();

program
	.name("agents")
	.description("Multi-agent CLI for collaborative problem solving")
	.version("0.1.0");

// Default action (no subcommand) starts chat
program
	.option(
		"-a, --agents <agents>",
		"Comma-separated list of agents to start",
		"claude,gemini",
	)
	.action(async (options) => {
		const agentNames = options.agents
			.split(",")
			.map((s: string) => s.trim()) as ("claude" | "gemini" | "codex")[];

		console.log("🚀 Starting multi-agent collaborative session...");
		console.log(`📋 Agents: ${agentNames.join(", ")}`);

		const agentManager = new StreamingAgentManager();
		const conversation = new ConversationManager();

		// Start agents
		const startResults = await Promise.all(
			agentNames.map(async (name) => {
				const started = await agentManager.startAgent(
					name as "claude" | "gemini" | "codex",
				);
				if (started) {
					conversation.addAgent(name);
				}
				return { name, started };
			}),
		);

		const successfulAgents = startResults
			.filter((r) => r.started)
			.map((r) => r.name);
		const failedAgents = startResults
			.filter((r) => !r.started)
			.map((r) => r.name);

		if (failedAgents.length > 0) {
			console.log(`⚠️  Failed to start agents: ${failedAgents.join(", ")}`);
		}

		if (successfulAgents.length === 0) {
			console.log("❌ No agents available. Exiting.");
			process.exit(1);
		}

		console.log(
			`✅ ${successfulAgents.length} agent(s) ready: ${successfulAgents.join(", ")}`,
		);
		console.log(
			"\n💡 Type your message and press Enter. All agents will respond.",
		);
		console.log(
			"💡 Type 'exit' to quit, 'clear' to clear conversation, or 'status' to see agent status.\n",
		);

		// Setup graceful shutdown
		const cleanup = () => {
			console.log("\n🔄 Shutting down agents...");
			agentManager.stopAllAgents();
			process.exit(0);
		};

		process.on("SIGINT", cleanup);
		process.on("SIGTERM", cleanup);

		// Main chat loop
		const rl = createInterface({ input, output });

		while (true) {
			try {
				const userInput = await rl.question("You: ");

				if (userInput.toLowerCase() === "exit") {
					break;
				}

				if (userInput.toLowerCase() === "clear") {
					conversation.clear();
					console.log("🧹 Conversation cleared.\n");
					continue;
				}

				if (userInput.toLowerCase() === "status") {
					const active = agentManager.getActiveAgents();
					console.log(
						`📊 Active agents: ${active.length > 0 ? active.join(", ") : "none"}\n`,
					);
					continue;
				}

				if (!userInput.trim()) {
					continue;
				}

				// Add user message to conversation
				conversation.addMessage("user", userInput);

				// Get responses from all active agents with streaming
				const activeAgents = agentManager.getActiveAgents();

				if (activeAgents.length === 0) {
					console.log("⚠️  No active agents available.\n");
					continue;
				}

				console.log("\n🤝 Agents are thinking...\n");

				// Create streaming response containers
				const agentOutputs = new Map<string, string>();
				const agentPromises: Promise<void>[] = [];

				// Start all agents streaming in parallel
				for (const agentName of activeAgents) {
					const emoji =
						agentName === "claude"
							? "🔵"
							: agentName === "gemini"
								? "🔴"
								: "🟡";
					console.log(`${emoji} ${agentName.toUpperCase()}:`);

					agentOutputs.set(agentName, "");

					const promise = new Promise<void>((resolve) => {
						agentManager.sendMessageWithStreaming(
							agentName,
							userInput,
							(chunk) => {
								// Stream the chunk immediately
								process.stdout.write(chunk);
								agentOutputs.set(
									agentName,
									agentOutputs.get(agentName)! + chunk,
								);
							},
							(response) => {
								// Agent finished
								if (response.error) {
									console.log(`\n❌ Error: ${response.error}`);
									conversation.addMessage(
										response.agent as any,
										`Error: ${response.error}`,
										"error",
									);
								} else {
									conversation.addMessage(
										response.agent as any,
										agentOutputs.get(agentName)!,
									);
								}
								console.log("\n"); // Empty line after each agent
								resolve();
							},
						);
					});

					agentPromises.push(promise);
				}

				// Wait for all agents to complete
				await Promise.all(agentPromises);
			} catch (error) {
				console.error("❌ Error in chat loop:", error);
			}
		}

		rl.close();
		cleanup();
	});

program
	.command("help <topic>")
	.description("Get help from multiple agents on a specific topic")
	.option(
		"-a, --agents <agents>",
		"Comma-separated list of agents to consult",
		"claude,gemini",
	)
	.action(async (topic: string, options) => {
		const agentNames = options.agents
			.split(",")
			.map((s: string) => s.trim()) as ("claude" | "gemini" | "codex")[];

		console.log(`🔍 Getting help on: "${topic}"`);
		console.log(`🤖 Consulting agents: ${agentNames.join(", ")}\n`);

		const agentManager = new StreamingAgentManager();
		const conversation = new ConversationManager();

		// Start agents
		const startResults = await Promise.all(
			agentNames.map(async (name) => {
				const started = await agentManager.startAgent(
					name as "claude" | "gemini" | "codex",
				);
				if (started) {
					conversation.addAgent(name);
				}
				return { name, started };
			}),
		);

		const successfulAgents = startResults
			.filter((r) => r.started)
			.map((r) => r.name);

		if (successfulAgents.length === 0) {
			console.log("❌ No agents available. Exiting.");
			process.exit(1);
		}

		// Add the help request to conversation
		conversation.addMessage("user", `I need help with: ${topic}`);

		// Get responses from all agents
		const responses = await Promise.all(
			successfulAgents.map(async (agentName) => {
				const context = conversation.getContextForAgent(agentName);
				return agentManager.sendMessage(agentName, context);
			}),
		);

		// Display responses
		for (const response of responses) {
			const emoji =
				response.agent === "claude"
					? "🔵"
					: response.agent === "gemini"
						? "🔴"
						: "🟡";
			console.log(`${emoji} ${response.agent.toUpperCase()}:`);

			if (response.error) {
				console.log(`❌ Error: ${response.error}`);
			} else {
				console.log(response.content);
			}

			console.log("".repeat(50)); // Separator line
		}

		// Cleanup
		agentManager.stopAllAgents();
	});

// Error handling
program.configureOutput({
	writeErr: (str) => process.stderr.write(str),
	writeOut: (str) => process.stdout.write(str),
});

process.on("uncaughtException", (error) => {
	console.error("❌ Uncaught exception:", error);
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	console.error("❌ Unhandled rejection:", reason);
	process.exit(1);
});

// Parse arguments and run
program.parse();
