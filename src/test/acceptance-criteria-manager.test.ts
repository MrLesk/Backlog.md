import { describe, expect, it } from "bun:test";
import { AcceptanceCriteriaManager, DefinitionOfDoneManager } from "../markdown/structured-sections.ts";

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

	it("removes and re-adds acceptance criteria in canonical order with stable spacing", () => {
		const initial = [
			"## Description",
			"",
			"<!-- SECTION:DESCRIPTION:BEGIN -->",
			"Something",
			"<!-- SECTION:DESCRIPTION:END -->",
			"",
			"## Acceptance Criteria",
			"<!-- AC:BEGIN -->",
			"- [ ] #1 Original",
			"<!-- AC:END -->",
			"",
			"## Implementation Plan",
			"",
			"<!-- SECTION:PLAN:BEGIN -->",
			"Plan",
			"<!-- SECTION:PLAN:END -->",
			"",
			"## Implementation Notes",
			"",
			"<!-- SECTION:NOTES:BEGIN -->",
			"Notes",
			"<!-- SECTION:NOTES:END -->",
			"",
			"## Comments",
			"",
			"<!-- COMMENTS:BEGIN -->",
			"created: 2026-07-11 12:00",
			"---",
			"Comment",
			"---",
			"<!-- COMMENTS:END -->",
			"",
			"## Final Summary",
			"",
			"<!-- SECTION:FINAL_SUMMARY:BEGIN -->",
			"Summary",
			"<!-- SECTION:FINAL_SUMMARY:END -->",
		].join("\n");

		const cleared = AcceptanceCriteriaManager.updateContent(initial, []);
		expect(cleared).not.toContain("## Acceptance Criteria");
		expect(cleared).not.toMatch(/\n{3,}/);

		const readded = AcceptanceCriteriaManager.updateContent(cleared, [
			{ checked: false, text: "Replacement", index: 1 },
		]);
		const headings = [
			"## Description",
			"## Acceptance Criteria",
			"## Implementation Plan",
			"## Implementation Notes",
			"## Comments",
			"## Final Summary",
		].map((heading) => readded.indexOf(heading));
		expect(headings).toEqual([...headings].sort((left, right) => left - right));
		expect(readded).not.toMatch(/\n{3,}/);
		expect(readded).toContain("<!-- AC:END -->\n\n## Implementation Plan");
	});

	it("preserves adjacent custom sections while replacing a checklist", () => {
		const content = [
			"## Description",
			"",
			"Something",
			"",
			"## Acceptance Criteria",
			"<!-- AC:BEGIN -->",
			"- [ ] #1 Original",
			"<!-- AC:END -->",
			"",
			"## Custom Details",
			"",
			"Keep this exactly.",
			"",
			"## Implementation Plan",
			"",
			"Plan",
		].join("\n");

		const updated = AcceptanceCriteriaManager.updateContent(content, [
			{ checked: false, text: "Replacement", index: 1 },
		]);
		expect(updated).toContain("## Custom Details\n\nKeep this exactly.");
		expect(updated).toContain("- [ ] #1 Replacement");
		expect(updated).not.toContain("Original");
		expect(updated).not.toMatch(/\n{3,}/);
	});

	it("is byte-stable across repeated acceptance criteria edit cycles", () => {
		const base = "## Description\n\nSomething\n\n## Implementation Plan\n\nPlan";
		const criteria = [
			{ checked: false, text: "First", index: 1 },
			{ checked: false, text: "Second", index: 2 },
		];
		const expected = AcceptanceCriteriaManager.updateContent(base, criteria);

		let cycled = expected;
		for (let index = 0; index < 3; index += 1) {
			cycled = AcceptanceCriteriaManager.addCriteria(cycled, ["Temporary"]);
			cycled = AcceptanceCriteriaManager.removeCriterionByIndex(cycled, 3);
			cycled = AcceptanceCriteriaManager.checkCriterionByIndex(cycled, 1, true);
			cycled = AcceptanceCriteriaManager.checkCriterionByIndex(cycled, 1, false);
			cycled = AcceptanceCriteriaManager.updateContent(cycled, []);
			cycled = AcceptanceCriteriaManager.updateContent(cycled, criteria);
		}

		expect(cycled).toBe(expected);
		expect(cycled).not.toMatch(/\n{3,}/);
	});

	it("applies canonical placement and stable spacing to Definition of Done", () => {
		const base = [
			"## Description",
			"",
			"Something",
			"",
			"## Acceptance Criteria",
			"<!-- AC:BEGIN -->",
			"- [ ] #1 Criterion",
			"<!-- AC:END -->",
			"",
			"## Implementation Plan",
			"",
			"Plan",
		].join("\n");
		const items = [{ checked: false, text: "Validate", index: 1 }];
		const expected = DefinitionOfDoneManager.updateContent(base, items);
		expect(expected.indexOf("## Definition of Done")).toBeGreaterThan(expected.indexOf("## Acceptance Criteria"));
		expect(expected.indexOf("## Definition of Done")).toBeLessThan(expected.indexOf("## Implementation Plan"));
		expect(expected).not.toMatch(/\n{3,}/);

		const cleared = DefinitionOfDoneManager.updateContent(expected, []);
		expect(cleared).not.toContain("## Definition of Done");
		expect(cleared).not.toMatch(/\n{3,}/);
		expect(DefinitionOfDoneManager.updateContent(cleared, items)).toBe(expected);
	});

	it("preserves CRLF through checklist removal and canonical reinsertion", () => {
		const base = "## Description\r\n\r\nSomething\r\n\r\n## Implementation Plan\r\n\r\nPlan";
		const cases = [
			{ manager: AcceptanceCriteriaManager, endMarker: "<!-- AC:END -->", text: "Criterion" },
			{ manager: DefinitionOfDoneManager, endMarker: "<!-- DOD:END -->", text: "DoD item" },
		];

		for (const { manager, endMarker, text } of cases) {
			const items = [{ checked: false, text, index: 1 }];
			const added = manager.updateContent(base, items);
			expect(added).not.toMatch(/(?<!\r)\n/);
			expect(added).toContain(`${endMarker}\r\n\r\n## Implementation Plan`);

			const cleared = manager.updateContent(added, []);
			expect(cleared).not.toMatch(/(?<!\r)\n/);
			const readded = manager.updateContent(cleared, items);
			expect(readded).toBe(added);
			expect(manager.updateContent(readded, items)).toBe(added);
		}
	});

	it("leaves content byte-for-byte unchanged when an empty checklist section is absent", () => {
		const content = "## Description\r\n\r\nSomething\r\n\r\n## Custom Details\r\n\r\nKeep this.\r\n";

		expect(AcceptanceCriteriaManager.updateContent(content, [])).toBe(content);
		expect(DefinitionOfDoneManager.updateContent(content, [])).toBe(content);
	});

	it("treats checklist-looking content inside foreign sentinel blocks as opaque", () => {
		const comments = [
			"## Comments",
			"",
			"<!-- COMMENTS:BEGIN -->",
			"## Acceptance Criteria",
			"- [ ] Comment checkbox",
			"<!-- AC:BEGIN -->",
			"- [ ] #1 Fake marked criterion",
			"<!-- AC:END -->",
			"## Definition of Done",
			"- [ ] Comment DoD checkbox",
			"<!-- DOD:BEGIN -->",
			"- [ ] #1 Fake marked DoD item",
			"<!-- DOD:END -->",
			"## Implementation Plan",
			"- [ ] Comment plan checkbox",
			"<!-- COMMENTS:END -->",
		].join("\n");

		expect(AcceptanceCriteriaManager.parseAllCriteria(comments)).toEqual([]);
		expect(DefinitionOfDoneManager.parseAllCriteria(comments)).toEqual([]);
		expect(AcceptanceCriteriaManager.updateContent(comments, [])).toBe(comments);
		expect(DefinitionOfDoneManager.updateContent(comments, [])).toBe(comments);

		const withAcceptanceCriteria = AcceptanceCriteriaManager.updateContent(comments, [
			{ checked: false, text: "Real criterion", index: 1 },
		]);
		expect(withAcceptanceCriteria).toContain(comments);
		expect(withAcceptanceCriteria.indexOf("- [ ] #1 Real criterion")).toBeLessThan(
			withAcceptanceCriteria.indexOf("<!-- COMMENTS:BEGIN -->"),
		);
		expect(withAcceptanceCriteria).toContain("- [ ] #1 Real criterion");

		const withDefinitionOfDone = DefinitionOfDoneManager.updateContent(comments, [
			{ checked: false, text: "Real DoD item", index: 1 },
		]);
		expect(withDefinitionOfDone).toContain(comments);
		expect(withDefinitionOfDone.indexOf("- [ ] #1 Real DoD item")).toBeLessThan(
			withDefinitionOfDone.indexOf("<!-- COMMENTS:BEGIN -->"),
		);
		expect(withDefinitionOfDone).toContain("- [ ] #1 Real DoD item");
	});

	it("resolves target markers only after masking nested known foreign families", () => {
		const cases = [
			{
				manager: AcceptanceCriteriaManager,
				header: "Acceptance Criteria",
				target: "AC",
				crossFamily: "DOD",
				text: "Real criterion",
			},
			{
				manager: DefinitionOfDoneManager,
				header: "Definition of Done",
				target: "DOD",
				crossFamily: "AC",
				text: "Real DoD item",
			},
		];

		for (const { manager, header, target, crossFamily, text } of cases) {
			const content = [
				"## Comments",
				"",
				"<!-- COMMENTS:BEGIN -->",
				`<!-- ${target}:END -->`,
				`<!-- ${target}:BEGIN -->`,
				"<!-- COMMENT:BEGIN -->",
				`<!-- ${target}:BEGIN -->`,
				"- [ ] #1 Fake nested item",
				`<!-- ${target}:END -->`,
				"<!-- COMMENT:END -->",
				"<!-- COMMENTS:END -->",
				`## ${crossFamily === "AC" ? "Acceptance Criteria" : "Definition of Done"}`,
				`<!-- ${crossFamily}:BEGIN -->`,
				`<!-- ${target}:BEGIN -->`,
				"- [ ] #1 Fake cross-family item",
				`<!-- ${target}:END -->`,
				`<!-- ${crossFamily}:END -->`,
				`## ${header}`,
				`<!-- ${target}:BEGIN -->`,
				`- [ ] #1 ${text}`,
				"<!-- SECTION:CUSTOM:BEGIN -->",
				"- [ ] #9 Opaque checkbox",
				`<!-- ${target}:END -->`,
				"<!-- SECTION:CUSTOM:END -->",
				`<!-- ${target}:END -->`,
				"<!-- COMMENT:BEGIN -->",
				`<!-- ${target}:END -->`,
				`<!-- ${target}:BEGIN -->`,
				"fake unmatched target markers after the real section",
				"<!-- COMMENT:END -->",
				"## Implementation Plan",
				"Plan",
			].join("\n");

			expect(manager.parseAllCriteria(content)).toEqual([{ checked: false, text, index: 1 }]);
			const replaced = manager.updateContent(content, [{ checked: false, text: `Replacement ${text}`, index: 1 }]);
			expect(replaced).toContain("- [ ] #9 Opaque checkbox");
			expect(replaced).toContain(`- [ ] #1 Replacement ${text}`);
			expect(manager.parseAllCriteria(replaced)).toEqual([{ checked: false, text: `Replacement ${text}`, index: 1 }]);
		}
	});

	it("keeps balanced inner foreign blocks opaque when an outer foreign marker is unclosed", () => {
		const cases = [
			{ manager: AcceptanceCriteriaManager, header: "Acceptance Criteria", target: "AC", text: "Real criterion" },
			{ manager: DefinitionOfDoneManager, header: "Definition of Done", target: "DOD", text: "Real DoD item" },
		];

		for (const { manager, header, target, text } of cases) {
			const content = [
				"<!-- COMMENTS:BEGIN -->",
				"outer marker intentionally unclosed",
				"<!-- COMMENTS:BEGIN -->",
				`<!-- ${target}:BEGIN -->`,
				"- [ ] #1 Fake inner item",
				`<!-- ${target}:END -->`,
				"<!-- COMMENTS:END -->",
				`## ${header}`,
				`<!-- ${target}:BEGIN -->`,
				`- [ ] #1 ${text}`,
				`<!-- ${target}:END -->`,
			].join("\n");

			expect(manager.parseAllCriteria(content)).toEqual([{ checked: false, text, index: 1 }]);
		}
	});

	it("does not let an unclosed foreign marker hide visible malformed target markers", () => {
		const cases = [
			{ manager: AcceptanceCriteriaManager, header: "Acceptance Criteria", target: "AC" },
			{ manager: DefinitionOfDoneManager, header: "Definition of Done", target: "DOD" },
		];

		for (const { manager, header, target } of cases) {
			const content = [
				"<!-- COMMENTS:BEGIN -->",
				"outer marker intentionally unclosed",
				`<!-- ${target}:END -->`,
				"<!-- COMMENTS:BEGIN -->",
				`<!-- ${target}:BEGIN -->`,
				"- [ ] #1 Fake inner item",
				`<!-- ${target}:END -->`,
				"<!-- COMMENTS:END -->",
				`## ${header}`,
				`<!-- ${target}:BEGIN -->`,
				"- [ ] #1 Real item",
				`<!-- ${target}:END -->`,
			].join("\n");

			expect(manager.parseAllCriteria(content)).toEqual([]);
			expect(() => manager.updateContent(content, [{ checked: false, text: "Replacement", index: 1 }])).toThrow(
				`Malformed ${header} markers`,
			);
		}
	});

	it("fails with a specific diagnostic for ambiguous visible target markers", () => {
		const cases = [
			{ manager: AcceptanceCriteriaManager, header: "Acceptance Criteria", target: "AC" },
			{ manager: DefinitionOfDoneManager, header: "Definition of Done", target: "DOD" },
		];
		const sequences = [
			{
				lines: (marker: string) => [
					`<!-- ${marker}:END -->`,
					`<!-- ${marker}:BEGIN -->`,
					"- [ ] #1 Existing",
					`<!-- ${marker}:END -->`,
				],
				detail: "without a preceding",
			},
			{
				lines: (marker: string) => [`<!-- ${marker}:BEGIN -->`, "- [ ] #1 Existing"],
				detail: "without a following",
			},
			{
				lines: (marker: string) => [
					`<!-- ${marker}:BEGIN -->`,
					`<!-- ${marker}:BEGIN -->`,
					"- [ ] #1 Existing",
					`<!-- ${marker}:END -->`,
					`<!-- ${marker}:END -->`,
				],
				detail: "found a second",
			},
		];

		for (const { manager, header, target } of cases) {
			for (const sequence of sequences) {
				const content = [`## ${header}`, ...sequence.lines(target), "", "## Implementation Plan", "Plan"].join("\n");
				expect(manager.parseAllCriteria(content)).toEqual([]);
				for (const replacement of [[], [{ checked: false, text: "Replacement", index: 1 }]]) {
					expect(() => manager.updateContent(content, replacement)).toThrow(`Malformed ${header} markers`);
					expect(() => manager.updateContent(content, replacement)).toThrow(sequence.detail);
				}
			}
		}
	});

	it("migrates legacy checklists when target-looking markers exist only inside COMMENT or COMMENTS", () => {
		const cases = [
			{ manager: AcceptanceCriteriaManager, header: "Acceptance Criteria", target: "AC", text: "Legacy criterion" },
			{ manager: DefinitionOfDoneManager, header: "Definition of Done", target: "DOD", text: "Legacy DoD item" },
		];

		for (const { manager, header, target, text } of cases) {
			const content = [
				"## Comments",
				"<!-- COMMENTS:BEGIN -->",
				`<!-- ${target}:BEGIN -->`,
				"- [ ] #1 Fake comments item",
				`<!-- ${target}:END -->`,
				"<!-- COMMENTS:END -->",
				"<!-- COMMENT:BEGIN -->",
				`<!-- ${target}:BEGIN -->`,
				"- [ ] #1 Fake comment item",
				`<!-- ${target}:END -->`,
				"<!-- COMMENT:END -->",
				`## ${header}`,
				`- [ ] ${text}`,
			].join("\n");

			expect(manager.parseAllCriteria(content)).toEqual([{ checked: false, text, index: 1 }]);
			const migrated = manager.migrateToStableFormat(content);
			expect(migrated).not.toBe(content);
			expect(migrated).toContain(`## ${header}\n<!-- ${target}:BEGIN -->\n- [ ] #1 ${text}\n<!-- ${target}:END -->`);
			expect(manager.migrateToStableFormat(migrated)).toBe(migrated);
		}
	});

	it("still parses legacy checklists when a balanced marker pair sits in prose without a header", () => {
		const cases = [
			{ manager: AcceptanceCriteriaManager, header: "Acceptance Criteria", target: "AC", text: "Legacy criterion" },
			{ manager: DefinitionOfDoneManager, header: "Definition of Done", target: "DOD", text: "Legacy DoD item" },
		];

		for (const { manager, header, target, text } of cases) {
			const proseMention = `Wrap items between <!-- ${target}:BEGIN --> and <!-- ${target}:END --> markers.`;
			const content = ["## Description", "", proseMention, "", `## ${header}`, "", `- [ ] ${text}`].join("\n");

			expect(manager.parseAllCriteria(content)).toEqual([{ checked: false, text, index: 1 }]);

			const added = manager.addCriteria(content, ["New item"]);
			expect(added).toContain(proseMention);
			expect(added).toContain(`- [ ] #1 ${text}`);
			expect(added).toContain("- [ ] #2 New item");
			expect(manager.parseAllCriteria(added)).toEqual([
				{ checked: false, text, index: 1 },
				{ checked: false, text: "New item", index: 2 },
			]);
		}
	});

	it("clears top-level legacy checklists but preserves prose-only namesake sections", () => {
		const cases = [
			{
				manager: AcceptanceCriteriaManager,
				header: "Acceptance Criteria",
				item: "Legacy criterion",
			},
			{
				manager: DefinitionOfDoneManager,
				header: "Definition of Done",
				item: "Legacy DoD item",
			},
		];

		for (const { manager, header, item } of cases) {
			const legacy = `## Description\n\nDetails\n\n## ${header}\n- [ ] ${item}\n\n## Custom Details\n\nKeep this.`;
			const cleared = manager.updateContent(legacy, []);
			expect(cleared).toBe("## Description\n\nDetails\n\n## Custom Details\n\nKeep this.");
			expect(manager.parseAllCriteria(legacy)).toEqual([{ checked: false, text: item, index: 1 }]);

			const prose = `## Description\r\n\r\nDetails\r\n\r\n## ${header}\r\nThis heading is ordinary prose, not a checklist.\r\n`;
			expect(manager.parseAllCriteria(prose)).toEqual([]);
			expect(manager.updateContent(prose, [])).toBe(prose);
		}
	});

	it("preserves foreign sentinel blocks nested in a real checklist body", () => {
		const content = [
			"## Acceptance Criteria",
			"<!-- AC:BEGIN -->",
			"- [ ] #1 Original",
			"<!-- SECTION:CUSTOM:BEGIN -->",
			"- [ ] This checkbox is opaque",
			"<!-- SECTION:CUSTOM:END -->",
			"<!-- AC:END -->",
		].join("\n");
		const foreignBlock = [
			"<!-- SECTION:CUSTOM:BEGIN -->",
			"- [ ] This checkbox is opaque",
			"<!-- SECTION:CUSTOM:END -->",
		].join("\n");

		expect(AcceptanceCriteriaManager.parseAllCriteria(content)).toEqual([
			{ checked: false, text: "Original", index: 1 },
		]);
		const replaced = AcceptanceCriteriaManager.updateContent(content, [
			{ checked: false, text: "Replacement", index: 1 },
		]);
		expect(replaced).toContain(foreignBlock);
		expect(replaced).toContain("- [ ] #1 Replacement");
		expect(AcceptanceCriteriaManager.updateContent(replaced, [{ checked: false, text: "Replacement", index: 1 }])).toBe(
			replaced,
		);

		const formatted = AcceptanceCriteriaManager.formatAcceptanceCriteria(
			[{ checked: false, text: "Formatted replacement", index: 1 }],
			["- [ ] #1 Original", foreignBlock].join("\n"),
		);
		expect(formatted).toContain(foreignBlock);
		expect(formatted).toContain("- [ ] #1 Formatted replacement");
	});
});

describe("deterministic empty checklist rewrites", () => {
	const cases = [
		{
			name: "acceptance criteria",
			manager: AcceptanceCriteriaManager,
			header: "Acceptance Criteria",
			beginMarker: "<!-- AC:BEGIN -->",
			endMarker: "<!-- AC:END -->",
			otherManager: DefinitionOfDoneManager,
			otherHeader: "Definition of Done",
			otherBeginMarker: "<!-- DOD:BEGIN -->",
			otherEndMarker: "<!-- DOD:END -->",
		},
		{
			name: "definition of done",
			manager: DefinitionOfDoneManager,
			header: "Definition of Done",
			beginMarker: "<!-- DOD:BEGIN -->",
			endMarker: "<!-- DOD:END -->",
			otherManager: AcceptanceCriteriaManager,
			otherHeader: "Acceptance Criteria",
			otherBeginMarker: "<!-- AC:BEGIN -->",
			otherEndMarker: "<!-- AC:END -->",
		},
	];

	it("retains one marked shell and every non-checkbox residual line when clearing", () => {
		for (const { manager, header, beginMarker, endMarker } of cases) {
			const content = [
				"## Description",
				"",
				"Details",
				"",
				`## ${header}`,
				beginMarker,
				"- [ ] #1 First row",
				"Keep this prose exactly.",
				"<!-- SECTION:CUSTOM:BEGIN -->",
				"- [ ] Opaque foreign checkbox",
				"",
				"",
				"Opaque tail.",
				"<!-- SECTION:CUSTOM:END -->",
				"Tail prose.",
				"- [x] #2 Second row",
				endMarker,
				"",
				"## Implementation Plan",
				"",
				"Plan",
			].join("\n");
			const residual = [
				`## ${header}`,
				beginMarker,
				"Keep this prose exactly.",
				"<!-- SECTION:CUSTOM:BEGIN -->",
				"- [ ] Opaque foreign checkbox",
				"",
				"",
				"Opaque tail.",
				"<!-- SECTION:CUSTOM:END -->",
				"Tail prose.",
				endMarker,
			].join("\n");

			const cleared = manager.updateContent(content, []);
			expect(cleared).toContain(residual);
			expect(cleared.match(new RegExp(beginMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(1);
			expect(cleared).not.toContain("First row");
			expect(cleared).not.toContain("Second row");
			expect(manager.parseAllCriteria(cleared)).toEqual([]);
			expect(manager.updateContent(cleared, [])).toBe(cleared);
		}
	});

	it("removes a rows-and-blanks-only shell with one blank line between neighbors", () => {
		for (const { manager, header, beginMarker, endMarker } of cases) {
			const content = [
				"## Description",
				"",
				"Details",
				"",
				`## ${header}`,
				beginMarker,
				"",
				"- [ ] #1 First row",
				"",
				"- [x] #2 Second row",
				"",
				endMarker,
				"",
				"## Implementation Plan",
				"",
				"Plan",
			].join("\n");

			expect(manager.updateContent(content, [])).toBe("## Description\n\nDetails\n\n## Implementation Plan\n\nPlan");
		}
	});

	it("re-adds deterministically after a residual-preserving clear", () => {
		for (const { manager, header, beginMarker, endMarker } of cases) {
			const content = [`## ${header}`, beginMarker, "- [ ] #1 Old row", "Keep this prose.", endMarker].join("\n");
			const cleared = manager.updateContent(content, []);
			const replacement = [{ checked: false, text: "Replacement", index: 1 }];
			const readded = manager.updateContent(cleared, replacement);

			expect(readded).toContain(`Keep this prose.\n\n- [ ] #1 Replacement\n${endMarker}`);
			expect(manager.updateContent(readded, replacement)).toBe(readded);
			expect(manager.updateContent(readded, [])).toBe(cleared);
		}
	});

	it("preserves CRLF while retaining residual shells", () => {
		for (const { manager, header, beginMarker, endMarker } of cases) {
			const content = [
				`## ${header}`,
				beginMarker,
				"- [ ] #1 Old row",
				"Residual prose.",
				endMarker,
				"",
				"## Implementation Plan",
				"",
				"Plan",
			].join("\r\n");

			const cleared = manager.updateContent(content, []);
			expect(cleared).not.toMatch(/(?<!\r)\n/);
			expect(cleared).toContain(`${beginMarker}\r\nResidual prose.\r\n${endMarker}`);
			expect(manager.updateContent(cleared, [])).toBe(cleared);
		}
	});

	it("does not change the other checklist family when clearing a residual shell", () => {
		for (const {
			manager,
			header,
			beginMarker,
			endMarker,
			otherManager,
			otherHeader,
			otherBeginMarker,
			otherEndMarker,
		} of cases) {
			const otherSection = [`## ${otherHeader}`, otherBeginMarker, "- [ ] #1 Other family row", otherEndMarker].join(
				"\n",
			);
			const content = [
				`## ${header}`,
				beginMarker,
				"- [ ] #1 Target row",
				"Target residual.",
				endMarker,
				"",
				otherSection,
			].join("\n");

			const cleared = manager.updateContent(content, []);
			expect(cleared).toContain(otherSection);
			expect(otherManager.parseAllCriteria(cleared)).toEqual([{ checked: false, text: "Other family row", index: 1 }]);
		}
	});

	it("converts a legacy checklist with residual prose to one stable marked shell", () => {
		for (const { manager, header, beginMarker, endMarker } of cases) {
			const legacy = [
				"## Description",
				"",
				"Details",
				"",
				`## ${header}`,
				"- [ ] Legacy row",
				"Keep legacy prose.",
				"",
				"## Implementation Plan",
				"",
				"Plan",
			].join("\n");

			const cleared = manager.updateContent(legacy, []);
			expect(cleared).toContain(`## ${header}\n${beginMarker}\nKeep legacy prose.\n${endMarker}`);
			expect(cleared).not.toContain("Legacy row");
			expect(manager.parseAllCriteria(cleared)).toEqual([]);
			expect(manager.updateContent(cleared, [])).toBe(cleared);
		}
	});
});
