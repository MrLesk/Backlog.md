import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerDecisionTools } from "../mcp/tools/decision-tools.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Decision Tools", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-decision-tools");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		// Initialize the project to create config
		await mcpServer.initializeProject("Test Project");

		registerDecisionTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("tool registration", () => {
		it("should register decision management tools", async () => {
			const result = await mcpServer.testInterface.listTools();
			const toolNames = result.tools.map((tool) => tool.name);

			expect(toolNames).toContain("decision_create");
		});

		it("should have proper tool schema", async () => {
			const result = await mcpServer.testInterface.listTools();
			const decisionCreateTool = result.tools.find((tool) => tool.name === "decision_create");

			expect(decisionCreateTool).toBeDefined();
			expect(decisionCreateTool?.description).toContain("Create a new Architecture Decision Record");
			expect(decisionCreateTool?.inputSchema).toBeDefined();
		});
	});

	describe("decision_create", () => {
		it("should create a decision with all fields", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Use React for Frontend",
						context: "We need to choose a frontend framework for the new project. The team has experience with React.",
						decision: "We will use React as the primary frontend framework.",
						consequences: "Better team productivity, established ecosystem, but larger bundle size.",
						alternatives: "Vue.js and Angular were also considered.",
						status: "accepted",
					},
				},
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0]?.text).toContain("# Decision Record Created");
			expect(result.content[0]?.text).toContain("✅ Successfully created");
			expect(result.content[0]?.text).toMatch(/decision-\d+/);
			expect(result.content[0]?.text).toContain("**File path:** `/decisions/");
			expect(result.content[0]?.text).toContain("**Title:** Use React for Frontend");
		});

		it("should create a decision with minimal required fields", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Minimal Decision",
					},
				},
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0]?.text).toContain("# Decision Record Created");
			expect(result.content[0]?.text).toContain("✅ Successfully created");
			expect(result.content[0]?.text).toMatch(/decision-\d+/);
		});

		it("should create decision with default status", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Default Status Decision",
						context: "Testing default status behavior",
					},
				},
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0]?.text).toContain("# Decision Record Created");
			expect(result.content[0]?.text).toContain("✅ Successfully created");

			// Verify the decision was created with default status in filesystem
			const decisions = await mcpServer.fs.listDecisions();
			const createdDecision = decisions.find((d) => d.title === "Default Status Decision");
			expect(createdDecision).toBeDefined();
			expect(createdDecision?.status).toBe("proposed");
		});

		it("should validate required fields", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						context: "Context without title",
						decision: "Decision without title",
					},
				},
			});

			expect(result.isError).toBeTruthy();
		});

		it("should validate decision status", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Invalid Status Decision",
						status: "invalid_status",
					},
				},
			});

			expect(result.isError).toBeTruthy();
		});

		it("should handle empty optional fields gracefully", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Empty Fields Decision",
						context: "",
						decision: "",
						consequences: "",
					},
				},
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0]?.text).toContain("# Decision Record Created");
			expect(result.content[0]?.text).toContain("✅ Successfully created");
		});

		it("should reject field values exceeding maxLength", async () => {
			const longString = "x".repeat(10001); // Exceeds maxLength of 10000

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Field Length Test",
						context: longString,
					},
				},
			});

			expect(result.isError).toBeTruthy();
			expect(result.content[0]?.text).toContain("exceeds maximum length of 10000 characters");
		});

		it("should reject titles exceeding maxLength", async () => {
			const longTitle = "x".repeat(201); // Exceeds maxLength of 200

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: longTitle,
					},
				},
			});

			expect(result.isError).toBeTruthy();
			expect(result.content[0]?.text).toContain("exceeds maximum length of 200 characters");
		});

		it("should support all valid status values", async () => {
			const statuses = ["proposed", "accepted", "rejected", "superseded"];

			for (const status of statuses) {
				const result = await mcpServer.testInterface.callTool({
					params: {
						name: "decision_create",
						arguments: {
							title: `${status} Decision`,
							status: status,
						},
					},
				});

				expect(result.isError).toBeFalsy();
				expect(result.content[0]?.text).toContain("# Decision Record Created");
				expect(result.content[0]?.text).toContain("✅ Successfully created");
			}
		});

		it("should include alternatives field when provided", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Decision with Alternatives",
						alternatives: "Option A: Use vanilla JS\nOption B: Use TypeScript\nOption C: Use CoffeeScript",
					},
				},
			});

			expect(result.isError).toBeFalsy();

			// Verify alternatives field is included in the saved decision
			const decisions = await mcpServer.fs.listDecisions();
			const createdDecision = decisions.find((d) => d.title === "Decision with Alternatives");
			expect(createdDecision).toBeDefined();
			expect(createdDecision?.alternatives).toContain("Option A");
		});

		it("should generate sequential IDs", async () => {
			// Create first decision
			const result1 = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "First Decision",
					},
				},
			});

			// Create second decision
			const result2 = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Second Decision",
					},
				},
			});

			expect(result1.isError).toBeFalsy();
			expect(result2.isError).toBeFalsy();

			const id1Match = (result1.content[0]?.text as string).match(/decision-(\d+)/);
			const id2Match = (result2.content[0]?.text as string).match(/decision-(\d+)/);

			expect(id1Match).toBeTruthy();
			expect(id2Match).toBeTruthy();

			const num1 = Number.parseInt(id1Match?.[1] || "0", 10);
			const num2 = Number.parseInt(id2Match?.[1] || "0", 10);

			expect(num2).toBeGreaterThan(num1);
		});
	});

	describe("integration with filesystem", () => {
		it("should persist decisions to filesystem", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Filesystem Persistence Test",
						context: "Testing filesystem persistence",
						decision: "This decision should be saved to the filesystem",
						consequences: "The decision will be available for future reference",
						status: "accepted",
					},
				},
			});

			// Verify the decision exists in filesystem
			const decisions = await mcpServer.fs.listDecisions();
			const persistedDecision = decisions.find((decision) => decision.title === "Filesystem Persistence Test");

			expect(persistedDecision).toBeDefined();
			expect(persistedDecision?.status).toBe("accepted");
			expect(persistedDecision?.context).toBe("Testing filesystem persistence");
			expect(persistedDecision?.decision).toBe("This decision should be saved to the filesystem");
			expect(persistedDecision?.consequences).toBe("The decision will be available for future reference");
		});

		it("should generate proper file names", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Special Characters! & Spaces Test",
					},
				},
			});

			expect(result.isError).toBeFalsy();

			// Check that the file path contains sanitized filename
			const filePath = result.content[0]?.text as string;
			expect(filePath).toMatch(/special-characters.*spaces-test\.md/i);
		});

		it("should create files in decisions directory", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Directory Test",
					},
				},
			});

			// Check that the decisions directory exists and contains the file
			const decisions = await mcpServer.fs.listDecisions();
			expect(decisions.length).toBeGreaterThan(0);

			const directoryTestDecision = decisions.find((d) => d.title === "Directory Test");
			expect(directoryTestDecision).toBeDefined();
		});

		it("should integrate with existing filesystem operations", async () => {
			// Create decision via filesystem directly
			const testDecision = {
				id: "decision-filesystem-test",
				title: "Filesystem Created Decision",
				date: new Date().toISOString().slice(0, 16).replace("T", " "),
				status: "proposed" as const,
				context: "Created directly via filesystem",
				decision: "Use filesystem operations for decision management",
				consequences: "Direct integration with core functionality",
				rawContent: "",
			};

			await mcpServer.fs.saveDecision(testDecision);

			// Verify it exists via filesystem
			const decisions = await mcpServer.fs.listDecisions();
			const foundDecision = decisions.find((decision) => decision.id === "decision-filesystem-test");

			expect(foundDecision).toBeDefined();
			expect(foundDecision?.title).toBe("Filesystem Created Decision");
			expect(foundDecision?.context).toBe("Created directly via filesystem");
		});
	});

	describe("error handling", () => {
		it("should handle filesystem errors gracefully", async () => {
			// Create a server with invalid filesystem path to trigger errors
			const invalidServer = new McpServer("/invalid/nonexistent/path");
			registerDecisionTools(invalidServer);

			const result = await invalidServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "Should Fail",
					},
				},
			});

			expect(result.isError).toBeTruthy();
			expect(result.content[0]?.text).toContain("Error creating decision");
		});

		it("should provide meaningful error messages", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "decision_create",
					arguments: {
						title: "", // Empty title should fail validation
					},
				},
			});

			expect(result.isError).toBeTruthy();
		});
	});
});
