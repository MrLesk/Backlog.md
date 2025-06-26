#!/usr/bin/env bun

import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { ConversationManager } from "./conversation.ts";

// Simple demo CLI to test the conversation flow without complex agent spawning
console.log("🚀 Multi-Agent Conversation Demo");
console.log("💡 This demo simulates Claude and Gemini responses");
console.log(
	"💡 Type your message and press Enter. Both 'agents' will respond.",
);
console.log("💡 Type 'exit' to quit, 'clear' to clear conversation.\n");

const conversation = new ConversationManager();
const rl = createInterface({ input, output });

// Mock agent responses for demo purposes
const mockClaudeResponse = (context: string): string => {
	const messages = context.split("\n").filter((line) => line.includes("USER:"));
	const lastMessage = messages[messages.length - 1] || "";

	if (lastMessage.toLowerCase().includes("hello")) {
		return "Hello! I'm Claude, ready to help with your questions. I see we're in a collaborative session with other agents.";
	} else if (lastMessage.toLowerCase().includes("what")) {
		return "That's a great question! Let me think about it systematically and provide a detailed response.";
	} else if (lastMessage.toLowerCase().includes("help")) {
		return "I'd be happy to help! Based on the conversation context, I can provide assistance with technical problems, coding, analysis, and more.";
	} else {
		return `I understand your message about: "${lastMessage.split(": ")[1] || "your request"}". As Claude, I'll provide a thoughtful response building on our conversation.`;
	}
};

const mockGeminiResponse = (context: string): string => {
	const messages = context.split("\n").filter((line) => line.includes("USER:"));
	const lastMessage = messages[messages.length - 1] || "";

	if (lastMessage.toLowerCase().includes("hello")) {
		return "Hi there! I'm Gemini, here to collaborate with Claude and Codex to help solve your problems together.";
	} else if (lastMessage.toLowerCase().includes("what")) {
		return "Interesting question! Let me offer a different perspective that might complement Claude's response.";
	} else if (lastMessage.toLowerCase().includes("help")) {
		return "Absolutely! I'm here to work with Claude and Codex to give you comprehensive assistance. We can tackle this from multiple angles.";
	} else {
		return `Thanks for sharing that! I'm Gemini, and I'd like to add to what Claude mentioned. Your point about "${lastMessage.split(": ")[1] || "the topic"}" is worth exploring further.`;
	}
};

const mockCodexResponse = (context: string): string => {
	const messages = context.split("\n").filter((line) => line.includes("USER:"));
	const lastMessage = messages[messages.length - 1] || "";

	if (lastMessage.toLowerCase().includes("hello")) {
		return "Hello! I'm Codex, specialized in technical and coding assistance. I'll work with Claude and Gemini to provide code-focused insights.";
	} else if (lastMessage.toLowerCase().includes("what")) {
		return "From a technical perspective, let me analyze this systematically and provide code-focused solutions.";
	} else if (lastMessage.toLowerCase().includes("help")) {
		return "I'm here to provide technical and coding expertise! I can help with implementation details, best practices, and code examples.";
	} else if (
		lastMessage.toLowerCase().includes("code") ||
		lastMessage.toLowerCase().includes("function") ||
		lastMessage.toLowerCase().includes("implement")
	) {
		return `Looking at "${lastMessage.split(": ")[1] || "the technical challenge"}", I can provide specific code examples and implementation strategies. Here's my technical analysis...`;
	} else {
		return `As Codex, I'll focus on the technical aspects of "${lastMessage.split(": ")[1] || "your request"}". Let me complement Claude and Gemini's responses with code-specific insights.`;
	}
};

// Main conversation loop
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

		if (!userInput.trim()) {
			continue;
		}

		// Add user message to conversation
		conversation.addMessage("user", userInput);

		console.log("\n🤝 Agents are thinking...\n");

		// Simulate agent responses (only Claude and Gemini by default, Codex available manually)
		const claudeContext = conversation.getContextForAgent("claude");
		const geminiContext = conversation.getContextForAgent("gemini");

		const claudeResponse = mockClaudeResponse(claudeContext);
		const geminiResponse = mockGeminiResponse(geminiContext);

		// Add responses to conversation
		conversation.addMessage("claude", claudeResponse);
		conversation.addMessage("gemini", geminiResponse);

		// Display responses
		console.log("🔵 CLAUDE:");
		console.log(claudeResponse);
		console.log("");

		console.log("🔴 GEMINI:");
		console.log(geminiResponse);
		console.log("");

		// Optional: Show how to add Codex manually
		if (
			userInput.toLowerCase().includes("codex") ||
			userInput.toLowerCase().includes("add codex")
		) {
			const codexContext = conversation.getContextForAgent("codex");
			const codexResponse = mockCodexResponse(codexContext);
			conversation.addMessage("codex", codexResponse);

			console.log("🟡 CODEX:");
			console.log(codexResponse);
			console.log("");
		}
	} catch (error) {
		console.error("❌ Error in demo:", error);
	}
}

rl.close();
console.log("\n👋 Demo session ended. Thanks for trying the multi-agent CLI!");
