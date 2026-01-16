import { describe, expect, it } from "bun:test";
import { AcceptanceCriteriaManager } from "../markdown/structured-sections.ts";

describe("AcceptanceCriteriaManager", () => {
	it("does not insert blank lines when adding new criteria (BACK-365)", () => {
		// Start with existing content that has 2 criteria
		const existingContent = `## Description

Some description

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 First criterion
- [ ] #2 Second criterion
<!-- AC:END -->
`;
		// Add a third criterion
		const updatedCriteria = [
			{ checked: false, text: "First criterion", index: 1 },
			{ checked: false, text: "Second criterion", index: 2 },
			{ checked: false, text: "Third criterion", index: 3 },
		];
		const result = AcceptanceCriteriaManager.updateContent(existingContent, updatedCriteria);

		// Extract the AC section and verify no blank lines between criteria
		const acSection = result.match(/<!-- AC:BEGIN -->([\s\S]*?)<!-- AC:END -->/)?.[1] || "";
		const lines = acSection.split("\n").filter((line) => line.trim() !== "");

		expect(lines).toHaveLength(3);
		expect(lines[0]).toBe("- [ ] #1 First criterion");
		expect(lines[1]).toBe("- [ ] #2 Second criterion");
		expect(lines[2]).toBe("- [ ] #3 Third criterion");

		// Also verify no double newlines in the AC section (which would indicate blank lines)
		expect(acSection).not.toContain("\n\n");
	});

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
