export type BrowserLoadingState =
	| { type: "loading"; message: string | null }
	| { type: "loaded" }
	| { type: "error"; message: string };

export function parseBrowserLoadingState(value: unknown): BrowserLoadingState | null {
	if (typeof value !== "string" || !value.startsWith("{")) return null;

	try {
		const state = JSON.parse(value) as Record<string, unknown>;
		if (state.type === "loaded") return { type: "loaded" };
		if (state.type === "loading" && (typeof state.message === "string" || state.message === null)) {
			return { type: "loading", message: state.message };
		}
		if (state.type === "error" && typeof state.message === "string") {
			return { type: "error", message: state.message };
		}
	} catch {}

	return null;
}
