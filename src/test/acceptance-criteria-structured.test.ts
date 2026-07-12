import { describe, expect, it } from "bun:test";
import { parseTask } from "../markdown/parser.ts";

describe("Structured Acceptance Criteria parsing", () => {
	it("parses acceptance criteria items with checked state and index", () => {
		const content = `---
id: task-999
title: Demo
status: To Do
assignee: []
created_date: 2025-01-01
labels: []
dependencies: []
---

## Description

X

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 First
- [x] #2 Second
<!-- AC:END -->
`;

		const task = parseTask(content);
		expect(task.acceptanceCriteriaItems?.length).toBe(2);
		expect(task.acceptanceCriteriaItems?.[0]).toEqual({ index: 1, text: "First", checked: false });
		expect(task.acceptanceCriteriaItems?.[1]).toEqual({ index: 2, text: "Second", checked: true });

		// Derived legacy-friendly text remains accessible by mapping items
		expect(task.acceptanceCriteriaItems?.map((item) => `#${item.index} ${item.text}`)).toEqual([
			"#1 First",
			"#2 Second",
		]);
	});
});
