import type { BacklogConfig } from "../types/index.ts";

export function formatAdvancedConfigSummary(config: BacklogConfig): string[] {
	return [
		"Advanced configuration updated.",
		`  Check active branches: ${config.checkActiveBranches ?? true}`,
		`  Remote operations: ${config.remoteOperations ?? true}`,
		`  Zero-padded IDs: ${typeof config.zeroPaddedIds === "number" ? `${config.zeroPaddedIds} digits` : "disabled"}`,
		`  Web UI port: ${config.defaultPort ?? 6420}`,
		`  Auto open browser: ${config.autoOpenBrowser ?? true}`,
		`  Bypass git hooks: ${config.bypassGitHooks ?? false}`,
		`  Auto commit: ${config.autoCommit ?? false}`,
		...(config.autoCommit ? [`  Auto commit mode: ${config.autoCommitMode ?? "new"}`] : []),
		`  Definition of Done defaults: ${(config.definitionOfDone ?? []).join(" | ") || "(none)"}`,
	];
}
