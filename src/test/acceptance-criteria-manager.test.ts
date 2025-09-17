import { describe, expect, it } from "bun:test";
import { AcceptanceCriteriaManager } from "../markdown/structured-sections.ts";

describe("AcceptanceCriteriaManager", () => {
	it("removes a single criterion without affecting other sections", () => {
		const base = AcceptanceCriteriaManager.formatAcceptanceCriteria([
			{ checked: false, text: "First", index: 1 },
			{ checked: false, text: "Second", index: 2 },
			{ checked: false, text: "Third", index: 3 },
		]);
		const content = `## Description\n\nSomething\n\n${base}\n\n## Notes\nExtra`;
		const updated = AcceptanceCriteriaManager.removeCriterionByIndex(content, 2);
		expect(updated).toContain("- [ ] #1 First");
		expect(updated).toContain("- [ ] #2 Third");
		expect(updated).toContain("## Notes");
		expect(updated).not.toContain("Second");
	});

	it("toggles a criterion and persists state", () => {
		const base = AcceptanceCriteriaManager.formatAcceptanceCriteria([{ checked: false, text: "Only", index: 1 }]);
		const updated = AcceptanceCriteriaManager.checkCriterionByIndex(base, 1, true);
		expect(updated).toContain("- [x] #1 Only");
	});
});
