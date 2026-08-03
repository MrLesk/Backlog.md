import { describe, expect, it } from "bun:test";
import { parseBrowserLoadingState } from "../utils/browser-loading-state.ts";

describe("browser loading state protocol", () => {
	it("preserves Core progress messages verbatim", () => {
		const message = "Applying latest task states from branch scans...";
		expect(parseBrowserLoadingState(JSON.stringify({ type: "loading", message }))).toEqual({
			type: "loading",
			message,
		});
	});

	it("leaves existing WebSocket publications outside the loading protocol", () => {
		expect(parseBrowserLoadingState("tasks-updated")).toBeNull();
		expect(parseBrowserLoadingState('{"type":"loading","message":42}')).toBeNull();
	});
});
