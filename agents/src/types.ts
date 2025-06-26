export interface Message {
	id: string;
	timestamp: number;
	sender: "user" | "claude" | "gemini";
	content: string;
	type: "message" | "error" | "system";
}

export interface ConversationState {
	messages: Message[];
	activeAgents: Set<string>;
	sessionId: string;
}

export interface AgentProcess {
	name: string;
	process: any;
	isAlive: boolean;
	lastResponse?: number;
}

export interface AgentResponse {
	agent: string;
	content: string;
	error?: string;
}
