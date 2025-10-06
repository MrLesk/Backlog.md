import { McpConnectionError } from "../errors/mcp-errors.ts";

/**
 * Time provider interface for dependency injection
 */
export interface TimeProvider {
	now(): number;
}

/**
 * Connection status type
 */
export type ConnectionStatus = "active" | "marked_for_removal";

/**
 * Represents an active MCP connection
 */
export interface Connection {
	id: string;
	clientId?: string;
	transport: unknown; // Can be HTTP, SSE, or other transport types
	createdAt: number;
	lastActivity: number;
	metadata?: Record<string, unknown>;
	removalAttempts: number;
	status: ConnectionStatus;
}

/**
 * Connection timeout configuration
 */
export interface ConnectionTimeout {
	inactivity: number; // milliseconds of inactivity before timeout
	absolute: number; // absolute maximum connection time in milliseconds
}

/**
 * Connection manager for handling MCP transport connections
 */
export class ConnectionManager {
	private connections = new Map<string, Connection>();
	private cleanupInterval?: NodeJS.Timeout;
	private timeouts: ConnectionTimeout;
	private timeProvider: TimeProvider;

	constructor(timeouts?: Partial<ConnectionTimeout>, timeProvider: TimeProvider = Date) {
		this.timeouts = {
			inactivity: timeouts?.inactivity || 30000, // 30 seconds
			absolute: timeouts?.absolute || 3600000, // 1 hour
		};
		this.timeProvider = timeProvider;
	}

	/**
	 * Register a new connection
	 */
	async registerConnection(
		connectionId: string,
		transport: unknown,
		clientId?: string,
		metadata?: Record<string, unknown>,
	): Promise<void> {
		// Remove existing connection with same ID if it exists
		if (this.connections.has(connectionId)) {
			await this.removeConnection(connectionId, "Replacing existing connection");
		}

		const now = this.timeProvider.now();
		const connection: Connection = {
			id: connectionId,
			clientId,
			transport,
			createdAt: now,
			lastActivity: now,
			metadata,
			removalAttempts: 0,
			status: "active",
		};

		this.connections.set(connectionId, connection);

		if (process.env.DEBUG) {
			console.log(
				`Connection registered: ${connectionId}${clientId ? ` (client: ${clientId})` : ""} - Total connections: ${this.connections.size}`,
			);
		}
	}

	/**
	 * Update the last activity time for a connection
	 */
	updateActivity(connectionId: string): boolean {
		const connection = this.connections.get(connectionId);
		if (!connection) {
			return false;
		}

		// Don't update activity if connection is marked for removal
		if (connection.status === "marked_for_removal") {
			return false;
		}

		connection.lastActivity = this.timeProvider.now();
		return true;
	}

	/**
	 * Get connection information
	 */
	getConnection(connectionId: string): Connection | undefined {
		return this.connections.get(connectionId);
	}

	/**
	 * Get all active connections
	 */
	getAllConnections(): Connection[] {
		return Array.from(this.connections.values());
	}

	/**
	 * Get connection statistics
	 */
	getStats(): {
		activeConnections: number;
		totalConnections: number;
		oldestConnection: number | null;
		connectionsPerClient: Record<string, number>;
	} {
		const connections = this.getAllConnections();
		const now = this.timeProvider.now();

		const connectionsPerClient: Record<string, number> = {};
		let oldestConnection: number | null = null;

		for (const conn of connections) {
			// Track per client
			const client = conn.clientId || "unknown";
			connectionsPerClient[client] = (connectionsPerClient[client] || 0) + 1;

			// Find oldest connection
			const age = now - conn.createdAt;
			if (oldestConnection === null || age > oldestConnection) {
				oldestConnection = age;
			}
		}

		return {
			activeConnections: connections.length,
			totalConnections: connections.length, // For now, same as active
			oldestConnection,
			connectionsPerClient,
		};
	}

	/**
	 * Remove a connection
	 */
	async removeConnection(connectionId: string, reason = "Manual removal"): Promise<boolean> {
		const connection = this.connections.get(connectionId);
		if (!connection) {
			return false;
		}

		// Clean up transport if it has a cleanup method
		try {
			const transport = connection.transport as { close?: () => Promise<void> | void };
			if (transport && typeof transport.close === "function") {
				await transport.close();
			}
		} catch (error) {
			console.error(`Error closing transport for connection ${connectionId}:`, error);
			// If this was called from cleanup and transport fails, don't remove - let retry logic handle it
			if (reason === "Expired") {
				throw error; // Let the cleanup logic handle the retry
			}
			// For manual removals, we still remove even if transport cleanup fails
		}

		// Remove from tracking
		this.connections.delete(connectionId);

		if (process.env.DEBUG) {
			console.log(`Connection removed: ${connectionId} (${reason}) - Remaining connections: ${this.connections.size}`);
		}

		return true;
	}

	/**
	 * Remove all connections
	 */
	async removeAllConnections(reason = "Shutdown"): Promise<void> {
		const connectionIds = Array.from(this.connections.keys());

		if (process.env.DEBUG) {
			console.log(`Removing all connections (${connectionIds.length}) - Reason: ${reason}`);
		}

		// Remove connections in parallel
		await Promise.all(connectionIds.map((id) => this.removeConnection(id, reason)));

		if (process.env.DEBUG) {
			console.log(`All connections removed (${reason})`);
		}
	}

	/**
	 * Clean up expired connections
	 */
	async cleanupExpiredConnections(): Promise<number> {
		const now = this.timeProvider.now();

		// Phase 1: Mark expired connections
		for (const [id, connection] of this.connections.entries()) {
			if (connection.status === "active") {
				const inactiveTime = now - connection.lastActivity;
				const totalTime = now - connection.createdAt;

				if (inactiveTime > this.timeouts.inactivity || totalTime > this.timeouts.absolute) {
					connection.status = "marked_for_removal";
					if (process.env.DEBUG) {
						console.log(`Marked connection ${id} for removal (inactive: ${inactiveTime}ms, total: ${totalTime}ms)`);
					}
				}
			}
		}

		// Phase 2: Remove marked connections
		let removedCount = 0;
		const connectionsToRemove: string[] = [];

		for (const [id, connection] of this.connections.entries()) {
			if (connection.status === "marked_for_removal") {
				if (connection.removalAttempts >= 3) {
					// Force remove after 3 failed attempts
					this.connections.delete(id);
					removedCount++;
					console.error(`Force removed connection ${id} after 3 failed attempts`);
				} else {
					connection.removalAttempts++;
					connectionsToRemove.push(id);
				}
			}
		}

		// Attempt to remove connections with retry logic
		for (const id of connectionsToRemove) {
			try {
				const removed = await this.removeConnection(id, "Expired");
				if (removed) {
					removedCount++;
				}
			} catch (error) {
				const connection = this.connections.get(id);
				if (connection) {
					console.error(`Removal attempt ${connection.removalAttempts} failed for ${id}:`, error);
				}
			}
		}

		if (removedCount > 0 && process.env.DEBUG) {
			console.log(`Cleaned up ${removedCount} expired connections`);
		}

		return removedCount;
	}

	/**
	 * Check if a connection exists and is active
	 */
	hasActiveConnection(connectionId: string): boolean {
		const connection = this.connections.get(connectionId);
		return connection !== undefined && connection.status === "active";
	}

	/**
	 * Validate connection and throw error if invalid
	 */
	validateConnection(connectionId: string): Connection {
		const connection = this.connections.get(connectionId);
		if (!connection) {
			throw new McpConnectionError(`Connection not found: ${connectionId}`);
		}

		if (connection.status === "marked_for_removal") {
			throw new McpConnectionError(`Connection expired: ${connectionId}`);
		}

		return connection;
	}

	/**
	 * Start periodic cleanup of expired connections
	 */
	startPeriodicCleanup(intervalMs = 30000): NodeJS.Timeout {
		// Stop existing cleanup if running
		this.stopPeriodicCleanup();

		this.cleanupInterval = setInterval(async () => {
			try {
				await this.cleanupExpiredConnections();
			} catch (error) {
				console.error("Error during periodic connection cleanup:", error);
			}
		}, intervalMs);

		return this.cleanupInterval;
	}

	/**
	 * Stop periodic cleanup
	 */
	stopPeriodicCleanup(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = undefined;
		}
	}

	/**
	 * Get connection timeout configuration
	 */
	getTimeouts(): ConnectionTimeout {
		return { ...this.timeouts };
	}

	/**
	 * Update connection timeout configuration
	 */
	updateTimeouts(timeouts: Partial<ConnectionTimeout>): void {
		this.timeouts = {
			...this.timeouts,
			...timeouts,
		};
		if (process.env.DEBUG) {
			console.log("Connection timeouts updated:", this.timeouts);
		}
	}
}
