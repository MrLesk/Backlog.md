import { eq } from "drizzle-orm";
import { db } from "../db";
import { config } from "../db/schema";
import type { BacklogConfig } from "@/types";

function parseJson<T>(val: string, fallback: T): T {
	try {
		return JSON.parse(val) as T;
	} catch {
		return fallback;
	}
}

export async function getConfig(): Promise<BacklogConfig> {
	const rows = await db.select().from(config);
	const map = new Map(rows.map((r) => [r.key, r.value]));

	return {
		projectName: map.get("project_name") ?? "My Project",
		statuses: parseJson<string[]>(map.get("statuses") ?? "[]", ["To Do", "In Progress", "Done"]),
		labels: parseJson<string[]>(map.get("labels") ?? "[]", []),
		milestones: parseJson<string[]>(map.get("milestones") ?? "[]", []),
		defaultStatus: map.get("default_status") ?? "To Do",
	};
}

export async function updateConfig(input: Partial<BacklogConfig>): Promise<BacklogConfig> {
	const updates: { key: string; value: string }[] = [];

	if (input.projectName !== undefined) updates.push({ key: "project_name", value: input.projectName });
	if (input.statuses !== undefined) updates.push({ key: "statuses", value: JSON.stringify(input.statuses) });
	if (input.labels !== undefined) updates.push({ key: "labels", value: JSON.stringify(input.labels) });
	if (input.milestones !== undefined)
		updates.push({ key: "milestones", value: JSON.stringify(input.milestones) });
	if (input.defaultStatus !== undefined) updates.push({ key: "default_status", value: input.defaultStatus });

	for (const { key, value } of updates) {
		await db
			.insert(config)
			.values({ key, value })
			.onConflictDoUpdate({ target: config.key, set: { value } });
	}

	return getConfig();
}
