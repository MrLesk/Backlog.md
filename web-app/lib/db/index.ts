import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function createDb() {
	const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
	const authToken = process.env.TURSO_AUTH_TOKEN;

	const client = createClient({
		url,
		authToken: authToken || undefined,
	});

	return drizzle(client, { schema });
}

// Singleton for reuse across requests (important for serverless cold starts)
const globalForDb = globalThis as unknown as { db: ReturnType<typeof createDb> };

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
	globalForDb.db = db;
}
