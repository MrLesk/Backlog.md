import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "../utils/logger.ts";

export interface JiraIssue {
	key: string;
	id: string;
	summary: string;
	description?: string;
	status: string;
	issueType: string;
	assignee?: string;
	reporter?: string;
	priority?: string;
	labels?: string[];
	created: string;
	updated: string;
	fields?: Record<string, unknown>;
}

export interface JiraSearchResult {
	issues: JiraIssue[];
	total: number;
	startAt: number;
	maxResults: number;
}

export interface JiraTransition {
	id: string;
	name: string;
	to: {
		id: string;
		name: string;
	};
}

/**
 * JiraClient wraps MCP Atlassian tools for Jira operations
 */
export class JiraClient {
	private client: Client | null = null;
	private dockerImage: string;

	constructor(dockerImage = "ghcr.io/sooperset/mcp-atlassian:latest") {
		this.dockerImage = dockerImage;
	}

	/**
	 * Initialize the MCP client connection
	 */
	private async ensureConnected(): Promise<Client> {
		if (this.client) {
			return this.client;
		}

		logger.debug("Initializing MCP client connection to Atlassian server");

		// Create MCP client
		this.client = new Client({
			name: "backlog-jira-client",
			version: "1.0.0",
		});

		// Get credentials from environment
		const jiraUrl = process.env.JIRA_URL;
		const jiraUsername = process.env.JIRA_EMAIL || process.env.JIRA_USERNAME;
		const jiraToken = process.env.JIRA_API_TOKEN;

		if (!jiraUrl || !jiraUsername || !jiraToken) {
			throw new Error(
				"Missing required Jira credentials. Please set JIRA_URL, JIRA_EMAIL (or JIRA_USERNAME), and JIRA_API_TOKEN environment variables.",
			);
		}

		// Create transport using Docker to spawn MCP Atlassian server
		const transport = new StdioClientTransport({
			command: "docker",
			args: [
				"run",
				"--rm",
				"-i",
				"-e",
				"JIRA_URL",
				"-e",
				"JIRA_USERNAME",
				"-e",
				"JIRA_API_TOKEN",
				this.dockerImage,
			],
			env: {
				...process.env,
				JIRA_URL: jiraUrl,
				JIRA_USERNAME: jiraUsername,
				JIRA_API_TOKEN: jiraToken,
			},
		});

		try {
			await this.client.connect(transport);
			logger.info("Successfully connected to MCP Atlassian server");
			return this.client;
		} catch (error) {
			logger.error({ error }, "Failed to connect to MCP Atlassian server");
			this.client = null;
			throw error;
		}
	}

	/**
	 * Close the MCP client connection
	 */
	async close(): Promise<void> {
		if (this.client) {
			await this.client.close();
			this.client = null;
			logger.debug("Closed MCP client connection");
		}
	}

	/**
	 * Call an MCP tool via MCP SDK
	 */
	private async callMcpTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
		try {
			const client = await this.ensureConnected();
			logger.info({ toolName, input }, "About to call MCP tool");

			const result = await client.callTool({
				name: toolName,
				arguments: input,
			});
			logger.info({ toolName, hasContent: !!result.content }, "MCP tool returned");

			// Extract the actual content from the MCP response
			if (result.content && result.content.length > 0) {
				const content = result.content[0];
				if (content.type === "text" && content.text) {
					try {
						// Try to parse as JSON
						const parsed = JSON.parse(content.text);
						logger.debug({ toolName }, "MCP tool call succeeded");
						return parsed;
					} catch {
						// Return as-is if not JSON
						return content.text;
					}
				}
			}

			// If there's structured content, use that
			if (result.structuredContent) {
				logger.debug({ toolName }, "MCP tool call succeeded with structured content");
				return result.structuredContent;
			}

			logger.warn({ toolName, result }, "MCP tool returned unexpected format");
			return result;
		} catch (error) {
			logger.error({ error, toolName }, "MCP tool call failed");
			throw error;
		}
	}

	/**
	 * Test if MCP Jira tools are accessible
	 */
	async test(): Promise<boolean> {
		try {
			// Use jira_get_all_projects as a simpler connection test
			// This doesn't require a specific user identifier
			await this.callMcpTool("jira_get_all_projects", {});
			logger.debug("MCP Jira tools are accessible");
			return true;
		} catch (error) {
			logger.error({ error }, "MCP Jira tools test failed");
			return false;
		} finally {
			// Always close the connection after testing
			await this.close();
		}
	}

	/**
	 * Search for Jira issues using JQL
	 */
	async searchIssues(
		jql: string,
		options?: { startAt?: number; maxResults?: number; fields?: string },
	): Promise<JiraSearchResult> {
		try {
			const input: Record<string, unknown> = {
				jql,
				start_at: options?.startAt || 0,
				limit: options?.maxResults || 50,
			};

			if (options?.fields) {
				input.fields = options.fields;
			}

			const result = (await this.callMcpTool("jira_search", input)) as {
				issues: Array<{
					key: string;
					id: string;
					fields: {
						summary: string;
						description?: string;
						status: { name: string };
						issuetype: { name: string };
						assignee?: { displayName: string };
						reporter?: { displayName: string };
						priority?: { name: string };
						labels?: string[];
						created: string;
						updated: string;
						[key: string]: unknown;
					};
				}>;
				total: number;
				startAt: number;
				maxResults: number;
			};

			const issues: JiraIssue[] = result.issues.map((issue) => ({
				key: issue.key,
				id: issue.id,
				summary: issue.fields.summary,
				description: issue.fields.description as string | undefined,
				status: issue.fields.status.name,
				issueType: issue.fields.issuetype.name,
				assignee: issue.fields.assignee?.displayName,
				reporter: issue.fields.reporter?.displayName,
				priority: issue.fields.priority?.name,
				labels: issue.fields.labels,
				created: issue.fields.created,
				updated: issue.fields.updated,
				fields: issue.fields,
			}));

			logger.info({ jql, count: issues.length, total: result.total }, "Searched Jira issues");

			return {
				issues,
				total: result.total,
				startAt: result.startAt,
				maxResults: result.maxResults,
			};
		} catch (error) {
			logger.error({ error, jql }, "Failed to search Jira issues");
			throw error;
		}
	}

	/**
	 * Get a specific Jira issue by key
	 */
	async getIssue(issueKey: string, options?: { fields?: string; expand?: string }): Promise<JiraIssue> {
		try {
			logger.info({ issueKey, options }, "getIssue called with parameters");
			const input: Record<string, unknown> = {
				issue_key: issueKey,
			};
			logger.info({ input }, "Built input object");

			if (options?.fields) {
				input.fields = options.fields;
			}
			if (options?.expand) {
				input.expand = options.expand;
			}

			const result = await this.callMcpTool("jira_get_issue", input);
			const typedResult = result as {
				key: string;
				id: string;
				summary: string;
				description?: string;
				status: { name: string; category?: string; color?: string };
				issue_type?: { name: string };
				assignee?: { display_name: string };
				reporter?: { display_name: string };
				priority?: { name: string };
				labels?: string[];
				created: string;
				updated: string;
				[key: string]: unknown;
			};

			const issue: JiraIssue = {
				key: typedResult.key,
				id: typedResult.id,
				summary: typedResult.summary,
				description: typedResult.description,
				status: typedResult.status.name,
				issueType: typedResult.issue_type?.name || "Task",
				assignee: typedResult.assignee?.display_name,
				reporter: typedResult.reporter?.display_name,
				priority: typedResult.priority?.name,
				labels: typedResult.labels || [],
				created: typedResult.created,
				updated: typedResult.updated,
				fields: typedResult as any,
			};

			logger.info({ issueKey }, "Retrieved Jira issue");
			return issue;
		} catch (error) {
			logger.error({ error, issueKey }, "Failed to get Jira issue");
			throw error;
		}
	}

	/**
	 * Update a Jira issue
	 */
	async updateIssue(
		issueKey: string,
		updates: {
			summary?: string;
			description?: string;
			assignee?: string;
			priority?: string;
			labels?: string[];
			fields?: Record<string, unknown>;
		},
	): Promise<void> {
		try {
			const fields: Record<string, unknown> = {};

			if (updates.summary) {
				fields.summary = updates.summary;
			}
			if (updates.description) {
				fields.description = updates.description;
			}
			if (updates.assignee) {
				fields.assignee = updates.assignee;
			}
			if (updates.priority) {
				fields.priority = { name: updates.priority };
			}
			if (updates.labels) {
				fields.labels = updates.labels;
			}
			if (updates.fields) {
				Object.assign(fields, updates.fields);
			}

			await this.callMcpTool("jira_update_issue", {
				issue_key: issueKey,
				fields,
			});

			logger.info({ issueKey, updates }, "Updated Jira issue");
		} catch (error) {
			logger.error({ error, issueKey, updates }, "Failed to update Jira issue");
			throw error;
		}
	}

	/**
	 * Get available transitions for an issue
	 */
	async getTransitions(issueKey: string): Promise<JiraTransition[]> {
		try {
			const result = (await this.callMcpTool("jira_get_transitions", {
				issue_key: issueKey,
			})) as {
				transitions: Array<{
					id: string;
					name: string;
					to: {
						id: string;
						name: string;
					};
				}>;
			};

			logger.debug({ issueKey, count: result.transitions.length }, "Retrieved Jira transitions");
			return result.transitions;
		} catch (error) {
			logger.error({ error, issueKey }, "Failed to get Jira transitions");
			throw error;
		}
	}

	/**
	 * Transition an issue to a new status
	 */
	async transitionIssue(
		issueKey: string,
		transitionId: string,
		options?: {
			comment?: string;
			fields?: Record<string, unknown>;
		},
	): Promise<void> {
		try {
			const input: Record<string, unknown> = {
				issue_key: issueKey,
				transition_id: transitionId,
			};

			if (options?.comment) {
				input.comment = options.comment;
			}
			if (options?.fields) {
				input.fields = options.fields;
			}

			await this.callMcpTool("jira_transition_issue", input);
			logger.info({ issueKey, transitionId }, "Transitioned Jira issue");
		} catch (error) {
			logger.error({ error, issueKey, transitionId }, "Failed to transition Jira issue");
			throw error;
		}
	}

	/**
	 * Add a comment to an issue
	 */
	async addComment(issueKey: string, comment: string): Promise<void> {
		try {
			await this.callMcpTool("jira_add_comment", {
				issue_key: issueKey,
				comment,
			});
			logger.info({ issueKey }, "Added comment to Jira issue");
		} catch (error) {
			logger.error({ error, issueKey }, "Failed to add comment to Jira issue");
			throw error;
		}
	}

	/**
	 * Create a new Jira issue
	 */
	async createIssue(
		projectKey: string,
		issueType: string,
		summary: string,
		options?: {
			description?: string;
			assignee?: string;
			priority?: string;
			labels?: string[];
			components?: string;
			fields?: Record<string, unknown>;
		},
	): Promise<JiraIssue> {
		try {
			const input: Record<string, unknown> = {
				project_key: projectKey,
				issue_type: issueType,
				summary,
			};

			if (options?.description) {
				input.description = options.description;
			}
			if (options?.assignee) {
				input.assignee = options.assignee;
			}
			if (options?.priority) {
				input.additional_fields = {
					...((input.additional_fields as Record<string, unknown>) || {}),
					priority: { name: options.priority },
				};
			}
			if (options?.labels) {
				input.additional_fields = {
					...((input.additional_fields as Record<string, unknown>) || {}),
					labels: options.labels,
				};
			}
			if (options?.components) {
				input.components = options.components;
			}
			if (options?.fields) {
				input.additional_fields = {
					...((input.additional_fields as Record<string, unknown>) || {}),
					...options.fields,
				};
			}

			const result = (await this.callMcpTool("jira_create_issue", input)) as {
				key: string;
				id: string;
				fields: {
					summary: string;
					description?: string;
					status: { name: string };
					issuetype: { name: string };
					created: string;
					updated: string;
					[key: string]: unknown;
				};
			};

			const issue: JiraIssue = {
				key: result.key,
				id: result.id,
				summary: result.fields.summary,
				description: result.fields.description as string | undefined,
				status: result.fields.status.name,
				issueType: result.fields.issuetype.name,
				created: result.fields.created,
				updated: result.fields.updated,
				fields: result.fields,
			};

			logger.info({ issueKey: issue.key, projectKey, issueType }, "Created Jira issue");
			return issue;
		} catch (error) {
			logger.error({ error, projectKey, issueType, summary }, "Failed to create Jira issue");
			throw error;
		}
	}
}
