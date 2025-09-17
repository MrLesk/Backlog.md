import type { Decision } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult } from "../types.ts";

/**
 * DecisionToolHandlers class containing all decision management business logic
 */
export class DecisionToolHandlers {
	constructor(private server: McpServer) {}

	/**
	 * Create a new Architecture Decision Record (ADR)
	 */
	async createDecision(args: {
		title: string;
		context: string;
		decision: string;
		consequences: string;
		alternatives?: string;
		status: "proposed" | "accepted" | "rejected" | "superseded";
	}): Promise<CallToolResult> {
		const { title, context, decision, consequences, alternatives, status } = args;

		try {
			// Generate decision ID using utility function
			const { generateNextDecisionId } = await import("../../utils/id-generators.js");
			const id = await generateNextDecisionId(this.server);

			const decisionRecord: Decision = {
				id,
				title,
				date: new Date().toISOString().slice(0, 16).replace("T", " "),
				status,
				context: context || "[Describe the context and problem that needs to be addressed]",
				decision: decision || "[Describe the decision that was made]",
				consequences: consequences || "[Describe the consequences of this decision]",
				alternatives,
			};

			await this.server.createDecision(decisionRecord);

			// Get the file path for the created decision
			const decisionFileName = `${id} - ${title
				.replace(/[^a-zA-Z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.toLowerCase()}.md`;

			return {
				content: [
					{
						type: "text",
						text: `Decision created successfully with ID: ${id}\nFile path: /decisions/${decisionFileName}`,
					},
				],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
			return {
				content: [
					{
						type: "text",
						text: `Error creating decision: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	}
}
