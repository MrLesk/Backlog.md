import { describe, expect, it, mock } from "bun:test";
import { JiraClient } from "./jira.ts";

describe("JiraClient", () => {
	describe("searchIssues", () => {
		it("should search issues with correct parameters", async () => {
			const client = new JiraClient();

			const mockResult = {
				issues: [
					{
						key: "PROJ-1",
						id: "10001",
						fields: {
							summary: "Test Issue",
							description: "Test description",
							status: { name: "To Do" },
							issuetype: { name: "Task" },
							assignee: { displayName: "Alice" },
							reporter: { displayName: "Bob" },
							priority: { name: "High" },
							labels: ["backend", "bug"],
							created: "2025-01-01T10:00:00.000Z",
							updated: "2025-01-02T15:30:00.000Z",
						},
					},
				],
				total: 1,
				startAt: 0,
				maxResults: 50,
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool = callMcpToolMock;

			const result = await client.searchIssues("project = PROJ", { maxResults: 10 });

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_search", {
				jql: "project = PROJ",
				start_at: 0,
				limit: 10,
			});

			expect(result.issues).toHaveLength(1);
			expect(result.issues[0]).toMatchObject({
				key: "PROJ-1",
				summary: "Test Issue",
				status: "To Do",
				assignee: "Alice",
				priority: "High",
			});
		});
	});

	describe("getIssue", () => {
		it("should get issue with correct parameters", async () => {
			const client = new JiraClient();

			const mockResult = {
				key: "PROJ-1",
				id: "10001",
				fields: {
					summary: "Test Issue",
					description: "Test description",
					status: { name: "To Do" },
					issuetype: { name: "Task" },
					created: "2025-01-01T10:00:00.000Z",
					updated: "2025-01-02T15:30:00.000Z",
				},
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool = callMcpToolMock;

			const issue = await client.getIssue("PROJ-1");

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_get_issue", {
				issue_key: "PROJ-1",
			});

			expect(issue).toMatchObject({
				key: "PROJ-1",
				summary: "Test Issue",
				status: "To Do",
			});
		});
	});

	describe("updateIssue", () => {
		it("should update issue with correct parameters", async () => {
			const client = new JiraClient();

			const callMcpToolMock = mock(() => Promise.resolve({}));
			(client as unknown as { callMcpTool: unknown }).callMcpTool = callMcpToolMock;

			await client.updateIssue("PROJ-1", {
				summary: "New Summary",
				description: "New description",
				assignee: "alice",
				priority: "High",
				labels: ["backend", "api"],
			});

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_update_issue", {
				issue_key: "PROJ-1",
				fields: {
					summary: "New Summary",
					description: "New description",
					assignee: "alice",
					priority: { name: "High" },
					labels: ["backend", "api"],
				},
			});
		});
	});

	describe("getTransitions", () => {
		it("should get transitions with correct parameters", async () => {
			const client = new JiraClient();

			const mockResult = {
				transitions: [
					{
						id: "11",
						name: "To Do",
						to: {
							id: "1",
							name: "To Do",
						},
					},
					{
						id: "21",
						name: "In Progress",
						to: {
							id: "2",
							name: "In Progress",
						},
					},
				],
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool = callMcpToolMock;

			const transitions = await client.getTransitions("PROJ-1");

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_get_transitions", {
				issue_key: "PROJ-1",
			});

			expect(transitions).toHaveLength(2);
			expect(transitions[0]).toMatchObject({
				id: "11",
				name: "To Do",
			});
		});
	});

	describe("transitionIssue", () => {
		it("should transition issue with correct parameters", async () => {
			const client = new JiraClient();

			const callMcpToolMock = mock(() => Promise.resolve({}));
			(client as unknown as { callMcpTool: unknown }).callMcpTool = callMcpToolMock;

			await client.transitionIssue("PROJ-1", "21", {
				comment: "Moving to In Progress",
			});

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_transition_issue", {
				issue_key: "PROJ-1",
				transition_id: "21",
				comment: "Moving to In Progress",
			});
		});
	});

	describe("createIssue", () => {
		it("should create issue with correct parameters", async () => {
			const client = new JiraClient();

			const mockResult = {
				key: "PROJ-2",
				id: "10002",
				fields: {
					summary: "New Issue",
					description: "New description",
					status: { name: "To Do" },
					issuetype: { name: "Task" },
					created: "2025-01-03T10:00:00.000Z",
					updated: "2025-01-03T10:00:00.000Z",
				},
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool = callMcpToolMock;

			const issue = await client.createIssue("PROJ", "Task", "New Issue", {
				description: "New description",
				assignee: "alice",
				priority: "High",
				labels: ["backend"],
			});

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_create_issue", {
				project_key: "PROJ",
				issue_type: "Task",
				summary: "New Issue",
				description: "New description",
				assignee: "alice",
				additional_fields: {
					priority: { name: "High" },
					labels: ["backend"],
				},
			});

			expect(issue).toMatchObject({
				key: "PROJ-2",
				summary: "New Issue",
				status: "To Do",
			});
		});
	});
});
