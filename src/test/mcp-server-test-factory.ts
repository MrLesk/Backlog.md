/**
 * MCP Server Test Factory - Type-Safe Test Helper for McpServer Instances
 *
 * Provides centralized, cached McpServer instances and fixtures to optimize test performance
 * while maintaining strict test isolation and type safety.
 *
 * Architecture:
 * - Hybrid Factory Pattern: Isolated instances for writes, cached instances for reads
 * - Type-Safe Configuration: Generic constraints prevent invalid test configurations
 * - Resource Management: Automatic cleanup and leak prevention
 * - Performance Monitoring: Built-in metrics for optimization tracking
 */

import { randomUUID } from "node:crypto";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerBoardTools } from "../mcp/tools/board-tools.ts";
import { registerConfigTools } from "../mcp/tools/config-tools.ts";
import { registerTaskTools } from "../mcp/tools/task-tools.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

// ===== TYPE DEFINITIONS =====

/** Branded type for server identification */
type ServerId = string & { readonly __brand: "ServerId" };

/** Branded type for test suite identification */
type TestSuiteId = string & { readonly __brand: "TestSuiteId" };

/** Test fixture types for type-safe fixture management */
export type TestFixtureType = "minimal" | "full" | "board-focused" | "task-focused";

/** Server configuration variants with discriminated unions */
export type ServerConfigVariant =
	| { type: "integration"; mockFs: false; mockGit: false; isolateState: true }
	| { type: "unit"; mockFs: true; mockGit: true; isolateState: true }
	| { type: "hybrid"; mockFs: boolean; mockGit: boolean; isolateState: boolean }
	| { type: "cached"; mockFs: boolean; mockGit: boolean; isolateState: boolean };

/** Base test configuration interface */
export interface TestServerConfig {
	readonly variant: ServerConfigVariant;
	readonly fixtures?: TestFixtureType[];
	readonly tools?: ("task" | "board" | "config")[];
}

/** Resource management interface */
interface ManagedResource {
	readonly dispose: () => Promise<void>;
	readonly isDisposed: boolean;
}

/** Server instance with lifecycle management */
export interface TestServerInstance extends ManagedResource {
	readonly server: McpServer;
	readonly serverId: ServerId;
	readonly testDir: string;
	readonly createdAt: Date;
	readonly config: TestServerConfig;
	readonly refCount: number;
	addRef(): void;
	release(): Promise<void>;
}

/** Base test fixture interface */
interface BaseTestFixture {
	readonly id: string;
	readonly createdAt: Date;
}

/** Task-focused test fixture */
interface TaskTestFixture extends BaseTestFixture {
	readonly tasks: Array<{ id: string; title: string; status: string }>;
	readonly boards?: never;
}

/** Board-focused test fixture */
interface BoardTestFixture extends BaseTestFixture {
	readonly boards: Array<{ name: string; columns: string[] }>;
	readonly tasks?: Array<{ id: string; title: string; status: string }>;
}

/** Full test fixture */
interface FullTestFixture extends BaseTestFixture {
	readonly tasks: Array<{ id: string; title: string; status: string }>;
	readonly boards: Array<{ name: string; columns: string[] }>;
	readonly config: Record<string, string>;
}

/** Type-safe fixture mapping */
export type TestFixture<T extends TestFixtureType> = T extends "task-focused"
	? TaskTestFixture
	: T extends "board-focused"
		? BoardTestFixture
		: T extends "full"
			? FullTestFixture
			: BaseTestFixture;

/** Test context with type-safe fixtures */
export interface TypedTestContext<TFixture extends TestFixtureType> {
	readonly server: McpServer;
	readonly serverId: ServerId;
	readonly fixture: TestFixture<TFixture>;
	readonly cleanup: () => Promise<void>;
}

/** Performance metrics for monitoring */
interface PerformanceMetrics {
	serverCreations: number;
	cacheHits: number;
	cacheMisses: number;
	averageCreationTime: number;
	readonly activeServers: number;
	totalCleanups: number;
}

// ===== CACHE KEY MANAGEMENT =====

interface CacheKey {
	readonly configHash: string;
	readonly fixtureTypes: readonly TestFixtureType[];
	readonly isolationLevel: "full" | "partial" | "none";
}

type CacheKeyString = string & { readonly __cacheKey: true };

function createCacheKey(config: TestServerConfig): CacheKeyString {
	const hash = JSON.stringify({
		variant: config.variant,
		fixtures: config.fixtures?.sort() || [],
		tools: config.tools?.sort() || [],
	});

	const isolationLevel = config.variant.isolateState ? "full" : "partial";

	return `${hash}-${isolationLevel}` as CacheKeyString;
}

// ===== REFERENCE COUNTED SERVER =====

class ReferenceCountedServer implements TestServerInstance {
	private _refCount = 1;
	private _isDisposed = false;

	constructor(
		public readonly server: McpServer,
		public readonly serverId: ServerId,
		public readonly testDir: string,
		public readonly config: TestServerConfig,
	) {}

	readonly createdAt = new Date();

	get refCount(): number {
		return this._refCount;
	}

	get isDisposed(): boolean {
		return this._isDisposed;
	}

	addRef(): void {
		if (this._isDisposed) {
			throw new Error(`Cannot add reference to disposed server ${this.serverId}`);
		}
		this._refCount++;
	}

	async release(): Promise<void> {
		this._refCount--;
		if (this._refCount <= 0) {
			await this.dispose();
		}
	}

	async dispose(): Promise<void> {
		if (this._isDisposed) return;

		this._isDisposed = true;
		try {
			await this.server.stop();
			await safeCleanup(this.testDir);
		} catch (error) {
			console.warn(`Failed to cleanup server ${this.serverId}:`, error);
		}
	}
}

// ===== MAIN FACTORY CLASS =====

export class McpServerTestFactory {
	private serverCache = new Map<CacheKeyString, ReferenceCountedServer>();
	private activeServers = new Set<ReferenceCountedServer>();
	private metrics: PerformanceMetrics = {
		serverCreations: 0,
		cacheHits: 0,
		cacheMisses: 0,
		averageCreationTime: 0,
		activeServers: 0,
		totalCleanups: 0,
	};

	/**
	 * Creates a new isolated server instance for write operations
	 * Always creates a fresh instance to ensure test isolation
	 */
	async createIsolatedServer(
		testId: string,
		config: TestServerConfig = { variant: { type: "integration", mockFs: false, mockGit: false, isolateState: true } },
	): Promise<TestServerInstance> {
		const startTime = Date.now();

		const serverId = `${testId}-${randomUUID().slice(0, 8)}` as ServerId;
		const testDir = createUniqueTestDir(`mcp-isolated-${testId}`);

		const server = await this.createServerInstance(testDir, config);
		const instance = new ReferenceCountedServer(server, serverId, testDir, config);

		this.activeServers.add(instance);
		this.updateMetrics(Date.now() - startTime, false);

		return instance;
	}

	/**
	 * Gets a cached read-only server instance for performance optimization
	 * Uses caching for read-heavy operations that don't modify state
	 */
	async getReadOnlyServer(
		fixtures: TestFixtureType[] = ["minimal"],
		config: TestServerConfig = { variant: { type: "cached", mockFs: true, mockGit: true, isolateState: false } },
	): Promise<TestServerInstance> {
		const cacheKey = createCacheKey({ ...config, fixtures });

		let instance = this.serverCache.get(cacheKey);
		if (instance && !instance.isDisposed) {
			instance.addRef();
			this.metrics.cacheHits++;
			return instance;
		}

		// Create new cached instance
		const startTime = Date.now();
		this.metrics.cacheMisses++;

		const serverId = `cached-${randomUUID().slice(0, 8)}` as ServerId;
		const testDir = createUniqueTestDir(`mcp-cached-${serverId}`);

		const server = await this.createServerInstance(testDir, config);
		await this.createFixtures(server, fixtures);

		instance = new ReferenceCountedServer(server, serverId, testDir, config);

		this.serverCache.set(cacheKey, instance);
		this.activeServers.add(instance);
		this.updateMetrics(Date.now() - startTime, true);

		return instance;
	}

	/**
	 * Creates a typed test context with fixtures
	 */
	async createTestContext<TFixture extends TestFixtureType>(options: {
		testId: string;
		fixture: TFixture;
		isolated?: boolean;
	}): Promise<TypedTestContext<TFixture>> {
		const config: TestServerConfig = {
			variant:
				options.isolated !== false
					? { type: "integration", mockFs: false, mockGit: false, isolateState: true }
					: { type: "cached", mockFs: true, mockGit: true, isolateState: false },
			fixtures: [options.fixture],
			tools: ["task", "board", "config"],
		};

		const instance =
			options.isolated !== false
				? await this.createIsolatedServer(options.testId, config)
				: await this.getReadOnlyServer([options.fixture], config);

		const fixture = await this.createTypedFixture(instance.server, options.fixture);

		return {
			server: instance.server,
			serverId: instance.serverId,
			fixture,
			cleanup: () => instance.release(),
		};
	}

	/**
	 * Resets server state for reuse (cached instances only)
	 */
	async resetServerState(server: McpServer): Promise<void> {
		// For now, we don't implement state reset since we're using isolation
		// This would be needed for more aggressive caching scenarios
		console.warn("State reset not implemented - using fresh instances for isolation");
	}

	/**
	 * Gets performance metrics
	 */
	getPerformanceMetrics(): PerformanceMetrics {
		return {
			...this.metrics,
			activeServers: this.activeServers.size,
		};
	}

	/**
	 * Cleanup all cached instances and active servers
	 */
	async dispose(): Promise<void> {
		const cleanup = Array.from(this.activeServers).map((instance) => instance.dispose());
		await Promise.allSettled(cleanup);

		this.serverCache.clear();
		this.activeServers.clear();
		this.metrics.totalCleanups++;
	}

	// ===== PRIVATE HELPER METHODS =====

	private async createServerInstance(testDir: string, config: TestServerConfig): Promise<McpServer> {
		const server = new McpServer(testDir);

		// Setup filesystem and git
		await server.filesystem.ensureBacklogStructure();

		if (!config.variant.mockGit) {
			await $`git init -b main`.cwd(testDir).quiet();
			await $`git config user.name "Test User"`.cwd(testDir).quiet();
			await $`git config user.email test@example.com`.cwd(testDir).quiet();
		}

		// Initialize project
		await server.initializeProject("Test Project");

		// Register tools based on configuration
		const tools = config.tools || ["task", "board", "config"];
		if (tools.includes("task")) registerTaskTools(server);
		if (tools.includes("board")) registerBoardTools(server);
		if (tools.includes("config")) registerConfigTools(server);

		return server;
	}

	private async createFixtures(server: McpServer, fixtureTypes: TestFixtureType[]): Promise<void> {
		for (const fixtureType of fixtureTypes) {
			await this.createTypedFixture(server, fixtureType);
		}
	}

	private async createTypedFixture<T extends TestFixtureType>(
		server: McpServer,
		fixtureType: T,
	): Promise<TestFixture<T>> {
		const baseFixture = {
			id: randomUUID(),
			createdAt: new Date(),
		};

		switch (fixtureType) {
			case "task-focused": {
				const tasks = await this.createTestTasks(server);
				return { ...baseFixture, tasks } as TestFixture<T>;
			}

			case "board-focused": {
				const boards = await this.createTestBoards(server);
				return { ...baseFixture, boards } as TestFixture<T>;
			}

			case "full": {
				const [fullTasks, fullBoards] = await Promise.all([
					this.createTestTasks(server),
					this.createTestBoards(server),
				]);
				return {
					...baseFixture,
					tasks: fullTasks,
					boards: fullBoards,
					config: { defaultStatus: "To Do", defaultPriority: "Medium" },
				} as unknown as TestFixture<T>;
			}

			default:
				return baseFixture as TestFixture<T>;
		}
	}

	private async createTestTasks(server: McpServer): Promise<Array<{ id: string; title: string; status: string }>> {
		const tasks = [];
		for (let i = 1; i <= 3; i++) {
			const result = await server.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: `Test Task ${i}`,
						description: `Test description ${i}`,
					},
				},
			});

			const responseText = Array.isArray(result.content) ? result.content[0]?.text || "" : "";
			const taskIdMatch = responseText.match(/Successfully created task: (task-\d+)/);
			const taskId = taskIdMatch ? taskIdMatch[1] : `task-${i}`;

			tasks.push({ id: taskId, title: `Test Task ${i}`, status: "To Do" });
		}
		return tasks;
	}

	private async createTestBoards(server: McpServer): Promise<Array<{ name: string; columns: string[] }>> {
		// For now, return mock board data since board creation might not be available
		return [{ name: "Test Board", columns: ["To Do", "In Progress", "Done"] }];
	}

	private updateMetrics(creationTime: number, fromCache: boolean): void {
		this.metrics.serverCreations++;

		// Update rolling average
		const currentAvg = this.metrics.averageCreationTime;
		const count = this.metrics.serverCreations;
		this.metrics.averageCreationTime = (currentAvg * (count - 1) + creationTime) / count;
	}
}

// ===== SINGLETON INSTANCE =====

let factoryInstance: McpServerTestFactory | undefined;

/**
 * Gets the singleton factory instance
 */
export function getMcpServerTestFactory(): McpServerTestFactory {
	if (!factoryInstance) {
		factoryInstance = new McpServerTestFactory();
	}
	return factoryInstance;
}

/**
 * Cleans up the singleton factory (for test cleanup)
 */
export async function cleanupMcpServerTestFactory(): Promise<void> {
	if (factoryInstance) {
		await factoryInstance.dispose();
		factoryInstance = undefined;
	}
}
