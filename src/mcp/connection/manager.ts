import { McpConnectionError } from "../errors/mcp-errors.ts";

/**
 * Represents an active MCP connection
 */
export interface Connection {
	id: string;
	clientId?: string;
	transport: unknown; // Can be HTTP, SSE, or other transport types
	createdAt: number;
	lastActivity: number;
	timeoutId?: NodeJS.Timeout;
	metadata?: Record<string, unknown>;
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
	private timeouts: ConnectionTimeout;

	constructor(timeouts?: Partial<ConnectionTimeout>) {
		this.timeouts = {
			inactivity: timeouts?.inactivity || 30000, // 30 seconds
			absolute: timeouts?.absolute || 3600000, // 1 hour
		};
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
		const now = Date.now();

		// Remove existing connection with same ID if it exists
		if (this.connections.has(connectionId)) {
			await this.removeConnection(connectionId, "Replacing existing connection");
		}

		const connection: Connection = {
			id: connectionId,
			clientId,
			transport,
			createdAt: now,
			lastActivity: now,
			metadata,
		};

		// Set up inactivity timeout
		this.setupTimeouts(connection);

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

		connection.lastActivity = Date.now();

		// Reset inactivity timeout
		if (connection.timeoutId) {
			clearTimeout(connection.timeoutId);
		}
		this.setupInactivityTimeout(connection);

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
		const now = Date.now();

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

		// Clear any timeouts
		if (connection.timeoutId) {
			clearTimeout(connection.timeoutId);
		}

		// Clean up transport if it has a cleanup method
		try {
			const transport = connection.transport as { close?: () => Promise<void> | void };
			if (transport && typeof transport.close === "function") {
				await transport.close();
			}
		} catch (error) {
			console.error(`Error closing transport for connection ${connectionId}:`, error);
		}

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
		const now = Date.now();
		const expiredConnections: string[] = [];

		for (const [id, connection] of this.connections.entries()) {
			const inactiveTime = now - connection.lastActivity;
			const totalTime = now - connection.createdAt;

			if (inactiveTime > this.timeouts.inactivity || totalTime > this.timeouts.absolute) {
				expiredConnections.push(id);
			}
		}

		// Remove expired connections
		for (const id of expiredConnections) {
			await this.removeConnection(id, "Expired due to inactivity or timeout");
		}

		if (expiredConnections.length > 0 && process.env.DEBUG) {
			console.log(`Cleaned up ${expiredConnections.length} expired connections`);
		}

		return expiredConnections.length;
	}

	/**
	 * Set up timeouts for a connection
	 */
	private setupTimeouts(connection: Connection): void {
		// Set up inactivity timeout
		this.setupInactivityTimeout(connection);

		// Set up absolute timeout
		setTimeout(async () => {
			if (this.connections.has(connection.id)) {
				await this.removeConnection(connection.id, "Absolute timeout reached");
			}
		}, this.timeouts.absolute);
	}

	/**
	 * Set up inactivity timeout for a connection
	 */
	private setupInactivityTimeout(connection: Connection): void {
		connection.timeoutId = setTimeout(async () => {
			if (this.connections.has(connection.id)) {
				await this.removeConnection(connection.id, "Inactivity timeout");
			}
		}, this.timeouts.inactivity);
	}

	/**
	 * Check if a connection exists and is active
	 */
	hasActiveConnection(connectionId: string): boolean {
		return this.connections.has(connectionId);
	}

	/**
	 * Validate connection and throw error if invalid
	 */
	validateConnection(connectionId: string): Connection {
		const connection = this.connections.get(connectionId);
		if (!connection) {
			throw new McpConnectionError(`Connection not found: ${connectionId}`);
		}

		// Update activity
		this.updateActivity(connectionId);

		return connection;
	}

	/**
	 * Start periodic cleanup of expired connections
	 */
	startPeriodicCleanup(intervalMs = 60000): NodeJS.Timeout {
		return setInterval(async () => {
			try {
				await this.cleanupExpiredConnections();
			} catch (error) {
				console.error("Error during periodic connection cleanup:", error);
			}
		}, intervalMs);
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
