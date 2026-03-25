/**
 * Run this once to initialize the DB tables and seed default config.
 * Called automatically on first API request via lib/db/ensure-init.ts
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { config } from "./schema";

const DEFAULT_CONFIG: Record<string, string> = {
	project_name: "My Project",
	statuses: JSON.stringify(["To Do", "In Progress", "Done"]),
	labels: JSON.stringify([]),
	milestones: JSON.stringify([]),
	default_status: "To Do",
	next_task_id: "1",
	next_doc_id: "1",
	next_decision_id: "1",
};

export async function runMigrations() {
	const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
	const authToken = process.env.TURSO_AUTH_TOKEN;

	const client = createClient({ url, authToken: authToken || undefined });
	const db = drizzle(client);

	// Create tables manually (no migration files needed for simple schema)
	await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'To Do',
      priority TEXT,
      assignee TEXT NOT NULL DEFAULT '[]',
      reporter TEXT,
      labels TEXT NOT NULL DEFAULT '[]',
      milestone TEXT,
      dependencies TEXT NOT NULL DEFAULT '[]',
      parent_task_id TEXT,
      subtasks TEXT NOT NULL DEFAULT '[]',
      description TEXT,
      implementation_plan TEXT,
      implementation_notes TEXT,
      ordinal INTEGER DEFAULT 0,
      is_draft INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS acceptance_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      text TEXT NOT NULL,
      checked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
      id UNINDEXED,
      title,
      description,
      implementation_plan,
      implementation_notes,
      content=tasks,
      content_rowid=rowid
    );
  `);

	// Seed default config if empty
	const existing = await db.select().from(config).limit(1);
	if (existing.length === 0) {
		const entries = Object.entries(DEFAULT_CONFIG).map(([key, value]) => ({ key, value }));
		await db.insert(config).values(entries).onConflictDoNothing();
	}

	await client.close();
}
