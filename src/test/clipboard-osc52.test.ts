import { describe, expect, it } from "bun:test";
import { buildOsc52Sequence } from "../utils/clipboard.ts";

describe("buildOsc52Sequence", () => {
	it("wraps the base64-encoded text in an OSC 52 clipboard sequence", () => {
		const sequence = buildOsc52Sequence("BACK-123");
		const payload = Buffer.from("BACK-123", "utf8").toString("base64");
		expect(sequence).toBe(`\x1b]52;c;${payload}\x07`);
	});

	it("encodes multi-byte text as UTF-8", () => {
		const sequence = buildOsc52Sequence("täsk ✓");
		const payload = Buffer.from("täsk ✓", "utf8").toString("base64");
		expect(sequence).toBe(`\x1b]52;c;${payload}\x07`);
	});

	it("returns an empty-payload sequence for empty text", () => {
		const sequence = buildOsc52Sequence("");
		expect(sequence).toBe("\x1b]52;c;\x07");
	});

	it("wraps the sequence in a tmux DCS passthrough with doubled escapes", () => {
		const payload = Buffer.from("BACK-123", "utf8").toString("base64");
		const sequence = buildOsc52Sequence("BACK-123", { tmuxPassthrough: true });
		expect(sequence).toBe(`\x1bPtmux;\x1b\x1b]52;c;${payload}\x07\x1b\\`);
		expect(sequence.startsWith("\x1bPtmux;")).toBe(true);
		expect(sequence.endsWith("\x1b\\")).toBe(true);
	});

	it("omits tmux wrapping when tmuxPassthrough is false", () => {
		const payload = Buffer.from("BACK-123", "utf8").toString("base64");
		const sequence = buildOsc52Sequence("BACK-123", { tmuxPassthrough: false });
		expect(sequence).toBe(`\x1b]52;c;${payload}\x07`);
	});
});
