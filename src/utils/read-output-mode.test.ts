import { describe, expect, it } from "bun:test";
import { resolveReadOutputMode } from "./read-output-mode.ts";

describe("resolveReadOutputMode", () => {
	it("keeps explicit JSON noninteractive in a TTY", () => {
		expect(resolveReadOutputMode({ json: true }, true)).toBe("json");
	});

	it("preserves explicit and automatic plain modes", () => {
		expect(resolveReadOutputMode({ plain: true }, true)).toBe("plain");
		expect(resolveReadOutputMode({}, false)).toBe("plain");
	});

	it("uses the interactive mode only when both streams are TTYs", () => {
		expect(resolveReadOutputMode({}, true)).toBe("interactive");
	});

	it("rejects conflicting explicit modes", () => {
		expect(() => resolveReadOutputMode({ json: true, plain: true }, true)).toThrow(
			"--json cannot be combined with --plain.",
		);
	});
});
