import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";

export interface Mapping {
	backlogId: string;
	jiraKey: string;
	createdAt: string;
	updatedAt: string;
}

export interface Snapshot {
	backlogId: string;
	side: "backlog" | "jira";
	hash: string;
	payload: string;
	updatedAt: string;
}

export interface SyncState {
	backlogId: string;
	lastSyncAt: string | null;
	conflictState: string | null;
	strategy: string | null;
}

export interface OpLog {
	id: number;
	ts: string;
	op: string;
	backlogId: string | null;
	jiraKey: string | null;
	outcome: string;
	details: string | null;
}

export class SyncStore {
	private db: Database;

	constructor(dbPath?: string) {
		const configDir = join(process.cwd(), ".backlog-jira");
		if (!existsSync(configDir)) {
			mkdirSync(configDir, { recursive: true });
		}

		const finalPath = dbPath || join(configDir, "jira-sync.db");
		this.db = new Database(finalPath);
		this.init();
		logger.debug({ dbPath: finalPath }, "SyncStore initialized");
	}

	private init() {
		this.db.exec(`
			-- Task to Jira mapping
			CREATE TABLE IF NOT EXISTS mappings (
				backlog_id TEXT PRIMARY KEY,
				jira_key TEXT UNIQUE,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP
			);

			-- Snapshots for 3-way merge
			CREATE TABLE IF NOT EXISTS snapshots (
				backlog_id TEXT,
				side TEXT CHECK(side IN ('backlog', 'jira')),
				hash TEXT,
				payload TEXT,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY(backlog_id, side)
			);

			-- Sync state tracking
			CREATE TABLE IF NOT EXISTS sync_state (
				backlog_id TEXT PRIMARY KEY,
				last_sync_at TEXT,
				conflict_state TEXT,
				strategy TEXT
			);

			-- Operations audit log
			CREATE TABLE IF NOT EXISTS ops_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				ts TEXT DEFAULT CURRENT_TIMESTAMP,
				op TEXT,
				backlog_id TEXT,
				jira_key TEXT,
				outcome TEXT,
				details TEXT
			);
		`);
	}

	// Mapping methods
	addMapping(backlogId: string, jiraKey: string): void {
		const stmt = this.db.prepare(`
			INSERT OR REPLACE INTO mappings (backlog_id, jira_key, updated_at)
			VALUES (?, ?, CURRENT_TIMESTAMP)
		`);
		stmt.run(backlogId, jiraKey);
		logger.debug({ backlogId, jiraKey }, "Added mapping");
	}

	getMapping(backlogId: string): Mapping | null {
		const stmt = this.db.prepare("SELECT * FROM mappings WHERE backlog_id = ?");
		const row = stmt.get(backlogId) as any;
		if (!row) return null;
		return {
			backlogId: row.backlog_id,
			jiraKey: row.jira_key,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	getMappingByJiraKey(jiraKey: string): Mapping | null {
		const stmt = this.db.prepare("SELECT * FROM mappings WHERE jira_key = ?");
		const row = stmt.get(jiraKey) as any;
		if (!row) return null;
		return {
			backlogId: row.backlog_id,
			jiraKey: row.jira_key,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	getAllMappings(): Map<string, string> {
		const stmt = this.db.prepare("SELECT backlog_id, jira_key FROM mappings");
		const rows = stmt.all() as Array<{ backlog_id: string; jira_key: string }>;
		return new Map(rows.map((r) => [r.backlog_id, r.jira_key]));
	}

	deleteMapping(backlogId: string): void {
		const stmt = this.db.prepare("DELETE FROM mappings WHERE backlog_id = ?");
		stmt.run(backlogId);
		logger.debug({ backlogId }, "Deleted mapping");
	}

	// Snapshot methods
	setSnapshot(backlogId: string, side: "backlog" | "jira", hash: string, payload: unknown): void {
		const stmt = this.db.prepare(`
			INSERT OR REPLACE INTO snapshots (backlog_id, side, hash, payload, updated_at)
			VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		`);
		stmt.run(backlogId, side, hash, JSON.stringify(payload));
		logger.debug({ backlogId, side, hash }, "Set snapshot");
	}

	getSnapshot(backlogId: string, side: "backlog" | "jira"): Snapshot | null {
		const stmt = this.db.prepare("SELECT * FROM snapshots WHERE backlog_id = ? AND side = ?");
		return stmt.get(backlogId, side) as Snapshot | null;
	}

	getSnapshots(backlogId: string): { backlog: Snapshot | null; jira: Snapshot | null } {
		const backlog = this.getSnapshot(backlogId, "backlog");
		const jira = this.getSnapshot(backlogId, "jira");
		return { backlog, jira };
	}

	// Sync state methods
	updateSyncState(backlogId: string, updates: Partial<Omit<SyncState, "backlogId">>): void {
		const fields: string[] = [];
		const values: (string | null)[] = [];

		if (updates.lastSyncAt !== undefined) {
			fields.push("last_sync_at = ?");
			values.push(updates.lastSyncAt);
		}
		if (updates.conflictState !== undefined) {
			fields.push("conflict_state = ?");
			values.push(updates.conflictState);
		}
		if (updates.strategy !== undefined) {
			fields.push("strategy = ?");
			values.push(updates.strategy);
		}

		if (fields.length === 0) return;

		const stmt = this.db.prepare(`
			INSERT INTO sync_state (backlog_id, ${fields.map((f) => f.split(" = ")[0]).join(", ")})
			VALUES (?, ${fields.map(() => "?").join(", ")})
			ON CONFLICT(backlog_id) DO UPDATE SET ${fields.join(", ")}
		`);
		// Build the arguments array: backlogId + values for INSERT + values again for UPDATE
		const args: (string | null)[] = [backlogId, ...values, ...values];
		stmt.run(...args);
		logger.debug({ backlogId, updates }, "Updated sync state");
	}

	getSyncState(backlogId: string): SyncState | null {
		const stmt = this.db.prepare("SELECT * FROM sync_state WHERE backlog_id = ?");
		return stmt.get(backlogId) as SyncState | null;
	}

	// Operations log
	logOperation(op: string, backlogId: string | null, jiraKey: string | null, outcome: string, details?: string): void {
		const stmt = this.db.prepare(`
			INSERT INTO ops_log (op, backlog_id, jira_key, outcome, details)
			VALUES (?, ?, ?, ?, ?)
		`);
		stmt.run(op, backlogId, jiraKey, outcome, details || null);
		logger.debug({ op, backlogId, jiraKey, outcome }, "Logged operation");
	}

	getRecentOps(limit = 100): OpLog[] {
		const stmt = this.db.prepare("SELECT * FROM ops_log ORDER BY id DESC LIMIT ?");
		return stmt.all(limit) as OpLog[];
	}

	// Test write access for doctor command
	testWriteAccess(): void {
		this.db.prepare("SELECT 1").get();
	}

	close(): void {
		this.db.close();
	}
}
