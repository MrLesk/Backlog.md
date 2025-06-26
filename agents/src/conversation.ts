import type { ConversationState, Message } from "./types.ts";

export class ConversationManager {
	private state: ConversationState;
	private conversationFile: string;

	constructor() {
		this.state = {
			messages: [],
			activeAgents: new Set(),
			sessionId: `session-${Date.now()}`,
		};
		this.conversationFile = `/tmp/agents-conversation-${this.state.sessionId}.log`;
	}

	addMessage(
		sender: "user" | "claude" | "gemini",
		content: string,
		type: "message" | "error" | "system" = "message",
	): void {
		const message: Message = {
			id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			sender,
			content,
			type,
		};

		this.state.messages.push(message);
		this.persistToFile();
	}

	getFullContext(): string {
		return this.state.messages
			.map((msg) => {
				const timestamp = new Date(msg.timestamp).toLocaleTimeString();
				const prefix =
					msg.type === "system" ? "🔧" : msg.type === "error" ? "❌" : "";
				return `[${timestamp}] ${msg.sender.toUpperCase()}${prefix}: ${msg.content}`;
			})
			.join("\n");
	}

	getContextForAgent(agentName: string): string {
		const context = this.getFullContext();
		const prompt = `You are ${agentName} in a collaborative multi-agent conversation. Here's the full conversation history:

${context}

Please respond to the most recent message, building on the conversation context. You can reference and build upon what other agents have said.`;

		return prompt;
	}

	addAgent(agentName: string): void {
		this.state.activeAgents.add(agentName);
	}

	removeAgent(agentName: string): void {
		this.state.activeAgents.delete(agentName);
	}

	getActiveAgents(): string[] {
		return Array.from(this.state.activeAgents);
	}

	private persistToFile(): void {
		try {
			Bun.write(this.conversationFile, this.getFullContext());
		} catch (error) {
			console.error("Failed to persist conversation:", error);
		}
	}

	getSessionId(): string {
		return this.state.sessionId;
	}

	clear(): void {
		this.state.messages = [];
		this.persistToFile();
	}
}
