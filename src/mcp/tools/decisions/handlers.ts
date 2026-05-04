import type { Decision, DecisionSearchResult } from "../../../types/index.ts";
import { BacklogToolError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";
import { formatDecisionCallResult } from "../../utils/decision-response.ts";

export type DecisionListArgs = {
	search?: string;
};

export type DecisionViewArgs = {
	id: string;
};

export type DecisionCreateArgs = {
	title: string;
	content: string;
};

export type DecisionUpdateArgs = {
	id: string;
	title?: string;
	content: string;
};

export type DecisionSearchArgs = {
	query: string;
	limit?: number;
};

export class DecisionHandlers {
	constructor(private readonly core: McpServer) {}

	private formatSummaryLine(decision: Decision): string {
		const metadata: string[] = [`status: ${decision.status}`, `created: ${decision.date}`];

		if (decision.tags && decision.tags.length > 0) {
			metadata.push(`tags: ${decision.tags.join(", ")}`);
		} else {
			metadata.push("tags: (none)");
		}
		return `  ${decision.id} - ${decision.title} (${metadata.join(", ")})`;
	}

	private formatScore(score: number | null): string {
		if (score === null || score === undefined) {
			return "";
		}
		const invertedScore = 1 - score;
		return ` [score ${invertedScore.toFixed(3)}]`;
	}

	private async loadDecisionOrThrow(id: string): Promise<Decision> {
		const decision = await this.core.getDecision(id);
		if (!decision) {
			throw new BacklogToolError(`Decision not found: ${id}`, "DECISION_NOT_FOUND");
		}
		return decision;
	}

	async listDecisions(args: DecisionListArgs = {}): Promise<CallToolResult> {
		const search = args.search?.toLowerCase();
		const decisions = await this.core.filesystem.listDecisions();

		const filtered =
			search && search.length > 0
				? decisions.filter((decision) => {
						const haystacks = [decision.id, decision.title];
						return haystacks.some((value) => value.toLowerCase().includes(search));
					})
				: decisions;

		if (filtered.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "No decisions found.",
					},
				],
			};
		}

		const lines: string[] = ["Decisions:"];
		for (const decision of filtered) {
			lines.push(this.formatSummaryLine(decision));
		}

		return {
			content: [
				{
					type: "text",
					text: lines.join("\n"),
				},
			],
		};
	}

	async viewDecision(args: DecisionViewArgs): Promise<CallToolResult> {
		const decision = await this.loadDecisionOrThrow(args.id);
		return await formatDecisionCallResult(decision);
	}

	async createDecision(args: DecisionCreateArgs): Promise<CallToolResult> {
		try {
			const decision = await this.core.createDecisionWithTitle(args.title, args.content);
			return await formatDecisionCallResult(decision, {
				summaryLines: ["Decision created successfully."],
			});
		} catch (error) {
			if (error instanceof Error) {
				throw new BacklogToolError(`Failed to create decision: ${error.message}`, "OPERATION_FAILED");
			}
			throw new BacklogToolError("Failed to create decision.", "OPERATION_FAILED");
		}
	}

	async updateDecision(args: DecisionUpdateArgs): Promise<CallToolResult> {
		try {
			await this.core.updateDecisionFromContent(args.id, args.content, args.title);
			const refreshed = await this.core.getDecision(args.id);
			if (!refreshed) {
				throw new BacklogToolError(`Decision not found: ${args.id}`, "DECISION_NOT_FOUND");
			}
			return await formatDecisionCallResult(refreshed, {
				summaryLines: ["Decision updated successfully."],
			});
		} catch (error) {
			if (error instanceof Error) {
				throw new BacklogToolError(`Failed to update decision: ${error.message}`, "OPERATION_FAILED");
			}
			throw new BacklogToolError("Failed to update decision.", "OPERATION_FAILED");
		}
	}

	async searchDecisions(args: DecisionSearchArgs): Promise<CallToolResult> {
		const searchService = await this.core.getSearchService();
		const results = searchService.search({
			query: args.query,
			limit: args.limit,
			types: ["decision"],
		});

		const decisions = results.filter((result): result is DecisionSearchResult => result.type === "decision");
		if (decisions.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: `No decisions found for "${args.query}".`,
					},
				],
			};
		}

		const lines: string[] = ["Decisions:"];
		for (const result of decisions) {
			const { decision } = result;
			const scoreText = this.formatScore(result.score);
			lines.push(`  ${decision.id} - ${decision.title}${scoreText}`);
		}

		return {
			content: [
				{
					type: "text",
					text: lines.join("\n"),
				},
			],
		};
	}
}
