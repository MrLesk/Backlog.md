import { describe, expect, it } from "bun:test";
import { type AgentSelectionValue, PLACEHOLDER_AGENT_VALUE, processAgentSelection } from "../utils/agent-selection.ts";

const AGENTS_MD = "AGENTS.md" as const;
const CLAUDE_MD = "CLAUDE.md" as const;
const GEMINI_MD = "GEMINI.md" as const;

describe("processAgentSelection", () => {
	it("returns explicit selections", () => {
		const result = processAgentSelection({ selected: [AGENTS_MD, CLAUDE_MD] });
		expect(result.needsRetry).toBe(false);
		expect(result.files).toEqual([AGENTS_MD, CLAUDE_MD]);
		expect(result.skipped).toBe(false);
	});

	it("auto-selects highlighted item when none selected and fallback enabled", () => {
		const result = processAgentSelection({ selected: [], highlighted: GEMINI_MD, useHighlightFallback: true });
		expect(result.needsRetry).toBe(false);
		expect(result.files).toEqual([GEMINI_MD]);
		expect(result.skipped).toBe(false);
	});

	it("does not auto-select highlight when fallback disabled", () => {
		const result = processAgentSelection({ selected: [], highlighted: CLAUDE_MD });
		expect(result.needsRetry).toBe(true);
		expect(result.files).toEqual([]);
		expect(result.skipped).toBe(false);
	});

	it("ignores placeholder highlight even when fallback enabled", () => {
		const result = processAgentSelection({
			selected: [],
			highlighted: PLACEHOLDER_AGENT_VALUE,
			useHighlightFallback: true,
		});
		expect(result.needsRetry).toBe(true);
		expect(result.files).toEqual([]);
		expect(result.skipped).toBe(false);
	});

	it("requires retry when nothing highlighted or selected", () => {
		const result = processAgentSelection({ selected: [] });
		expect(result.needsRetry).toBe(true);
		expect(result.files).toEqual([]);
		expect(result.skipped).toBe(false);
	});

	it("filters out 'none' when combined with other selections", () => {
		const result = processAgentSelection({ selected: ["none", AGENTS_MD] as AgentSelectionValue[] });
		expect(result.needsRetry).toBe(false);
		expect(result.files).toEqual([AGENTS_MD]);
		expect(result.skipped).toBe(false);
	});

	it("reports skip when only 'none' is selected", () => {
		const result = processAgentSelection({ selected: ["none"] });
		expect(result.needsRetry).toBe(false);
		expect(result.files).toEqual([]);
		expect(result.skipped).toBe(true);
	});

	it("dedupes selections while preserving order", () => {
		const result = processAgentSelection({
			selected: [AGENTS_MD, CLAUDE_MD, AGENTS_MD, "none", CLAUDE_MD],
		});
		expect(result.needsRetry).toBe(false);
		expect(result.files).toEqual([AGENTS_MD, CLAUDE_MD]);
		expect(result.skipped).toBe(false);
	});
});
