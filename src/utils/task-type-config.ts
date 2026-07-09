import { DEFAULT_TASK_TYPES } from "../constants/index.ts";
import type { BacklogConfig } from "../types/index.ts";

type TaskTypeConfig = Pick<BacklogConfig, "types"> | readonly string[] | null | undefined;

function normalizeTaskTypeValue(value: string | null | undefined): string | undefined {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	return normalized.length > 0 ? normalized : undefined;
}

export function getTaskTypeValues(configOrTypes?: TaskTypeConfig): string[] {
	const configuredTypes: readonly string[] = Array.isArray(configOrTypes)
		? configOrTypes
		: ((configOrTypes as Pick<BacklogConfig, "types"> | null | undefined)?.types ?? []);
	const values: string[] = [];
	const seen = new Set<string>();

	for (const entry of configuredTypes) {
		const value = String(entry ?? "").trim();
		const normalized = normalizeTaskTypeValue(value);
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		values.push(value);
	}

	return values.length > 0 ? values : [...DEFAULT_TASK_TYPES];
}

export function resolveTaskTypeValue(
	value: string | null | undefined,
	configOrTypes?: TaskTypeConfig,
): string | undefined {
	const normalized = normalizeTaskTypeValue(value);
	if (!normalized) {
		return undefined;
	}
	return getTaskTypeValues(configOrTypes).find((type) => normalizeTaskTypeValue(type) === normalized);
}

export function formatValidTaskTypeValues(configOrTypes?: TaskTypeConfig): string {
	return getTaskTypeValues(configOrTypes).join(", ");
}
