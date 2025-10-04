import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	createDecisionsListResource,
	createDocsListResource,
	createDraftsListResource,
	createProjectOverviewResource,
	registerDataResources,
} from "../mcp/resources/data-resources.ts";
import { McpServer } from "../mcp/server.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("New Data Resources", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-new-data-resources");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		// Initialize the project to create config
		await mcpServer.initializeProject("Test Project");

		registerDataResources(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("resource registration", () => {
		it("should register all new resources", async () => {
			const result = await mcpServer.testInterface.listResources();
			const resourceUris = result.resources.map((resource) => resource.uri);

			expect(resourceUris).toContain("backlog://drafts/list");
			expect(resourceUris).toContain("backlog://docs/list");
			expect(resourceUris).toContain("backlog://decisions/list");
			expect(resourceUris).toContain("backlog://project/overview");
		});

		it("should have proper resource metadata", async () => {
			const result = await mcpServer.testInterface.listResources();
			const draftsResource = result.resources.find((r) => r.uri === "backlog://drafts/list");
			const docsResource = result.resources.find((r) => r.uri === "backlog://docs/list");
			const decisionsResource = result.resources.find((r) => r.uri === "backlog://decisions/list");
			const overviewResource = result.resources.find((r) => r.uri === "backlog://project/overview");

			expect(draftsResource).toBeDefined();
			expect(draftsResource?.name).toBe("Drafts List");
			expect(draftsResource?.mimeType).toBe("application/json");

			expect(docsResource).toBeDefined();
			expect(docsResource?.name).toBe("Documents List");
			expect(docsResource?.mimeType).toBe("application/json");

			expect(decisionsResource).toBeDefined();
			expect(decisionsResource?.name).toBe("Decisions List");
			expect(decisionsResource?.mimeType).toBe("application/json");

			expect(overviewResource).toBeDefined();
			expect(overviewResource?.name).toBe("Project Overview");
			expect(overviewResource?.mimeType).toBe("application/json");
		});
	});

	describe("drafts/list resource", () => {
		it("should return empty drafts list", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://drafts/list" },
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents?.[0]?.mimeType).toBe("application/json");

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.drafts).toBeDefined();
			expect(response.drafts).toHaveLength(0);
			expect(response.metadata).toBeDefined();
			expect(response.metadata.totalDrafts).toBe(0);
		});
	});

	describe("docs/list resource", () => {
		it("should return empty documents list", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://docs/list" },
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents?.[0]?.mimeType).toBe("application/json");

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.documents).toBeDefined();
			expect(response.documents).toHaveLength(0);
			expect(response.metadata).toBeDefined();
			expect(response.metadata.totalDocuments).toBe(0);
		});
	});

	describe("decisions/list resource", () => {
		it("should return empty decisions list", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://decisions/list" },
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents?.[0]?.mimeType).toBe("application/json");

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.decisions).toBeDefined();
			expect(response.decisions).toHaveLength(0);
			expect(response.metadata).toBeDefined();
			expect(response.metadata.totalDecisions).toBe(0);
		});
	});

	describe("project/overview resource", () => {
		it("should return project overview", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://project/overview" },
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents?.[0]?.mimeType).toBe("application/json");

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.overview).toBeDefined();
			expect(response.overview.projectName).toBe("Test Project");
			expect(response.overview.totalTasks).toBe(0);
			expect(response.overview.totalDrafts).toBe(0);
			expect(response.overview.totalDocuments).toBe(0);
			expect(response.overview.totalDecisions).toBe(0);
			expect(response.taskMetrics).toBeDefined();
			expect(response.distribution).toBeDefined();
			expect(response.quality).toBeDefined();
			expect(response.configuration).toBeDefined();
		});
	});

	describe("individual resource creators", () => {
		it("should create drafts list resource", () => {
			const resource = createDraftsListResource(mcpServer);
			expect(resource.uri).toBe("backlog://drafts/list");
			expect(resource.name).toBe("Drafts List");
			expect(resource.handler).toBeInstanceOf(Function);
		});

		it("should create docs list resource", () => {
			const resource = createDocsListResource(mcpServer);
			expect(resource.uri).toBe("backlog://docs/list");
			expect(resource.name).toBe("Documents List");
			expect(resource.handler).toBeInstanceOf(Function);
		});

		it("should create decisions list resource", () => {
			const resource = createDecisionsListResource(mcpServer);
			expect(resource.uri).toBe("backlog://decisions/list");
			expect(resource.name).toBe("Decisions List");
			expect(resource.handler).toBeInstanceOf(Function);
		});

		it("should create project overview resource", () => {
			const resource = createProjectOverviewResource(mcpServer);
			expect(resource.uri).toBe("backlog://project/overview");
			expect(resource.name).toBe("Project Overview");
			expect(resource.handler).toBeInstanceOf(Function);
		});
	});
});
