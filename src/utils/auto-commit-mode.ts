import { AUTO_COMMIT_MODES } from "../constants/index.ts";
import type { AutoCommitMode } from "../types/index.ts";

export const AUTO_COMMIT_MODE_ERROR = `Auto commit mode must be ${AUTO_COMMIT_MODES.join(" or ")}`;
export const AUTO_COMMIT_MODE_CONFIG_ERROR = `auto_commit_mode must be ${AUTO_COMMIT_MODES.join(" or ")}`;

export function isAutoCommitMode(value: unknown): value is AutoCommitMode {
	return typeof value === "string" && AUTO_COMMIT_MODES.some((mode) => mode === value);
}

export function normalizeAutoCommitMode(value: string): AutoCommitMode | null {
	const normalized = value.trim().toLowerCase();
	return isAutoCommitMode(normalized) ? normalized : null;
}
