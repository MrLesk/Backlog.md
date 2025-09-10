import { describe, expect, it } from "bun:test";
import { updateTaskDescription } from "../markdown/serializer.ts";

describe("updateTaskDescription", () => {
	it("should replace existing description section", () => {
		const content = `---
id: task-1
title: Test task
---

## Description

Old description

## Acceptance Criteria

- [ ] Test criterion

## Implementation Plan

Test plan`;

		const result = updateTaskDescription(content, "New description");

		expect(result).toContain("## Description\n\nNew description");
		expect(result).toContain("## Acceptance Criteria");
		expect(result).toContain("## Implementation Plan");
		expect(result).not.toContain("Old description");
	});

	it("should add description section if none exists and preserve other sections", () => {
		const content = `---
id: task-1
title: Test task
---

## Acceptance Criteria

- [ ] Test criterion`;

		const result = updateTaskDescription(content, "New description");

		expect(result).toContain("## Description\n\nNew description");
		expect(result).toContain("## Acceptance Criteria");
		// Description should come before acceptance criteria
		expect(result.indexOf("## Description")).toBeLessThan(result.indexOf("## Acceptance Criteria"));
	});

	it("should handle content without frontmatter and preserve other sections", () => {
		const content = `## Acceptance Criteria

- [ ] Test criterion`;

		const result = updateTaskDescription(content, "New description");

		expect(result).toContain("## Description\n\nNew description");
		expect(result).toContain("## Acceptance Criteria");
		// Description should come first
		expect(result.indexOf("## Description")).toBeLessThan(result.indexOf("## Acceptance Criteria"));
	});

	it("should handle empty content", () => {
		const content = `---
id: task-1
title: Test task
---

`;

		const result = updateTaskDescription(content, "New description");

		expect(result).toContain("## Description\n\nNew description");
	});

	it("should preserve complex sections", () => {
		const content = `---
id: task-1
title: Test task
---

## Description

Old description

## Acceptance Criteria

- [x] Completed criterion
- [ ] Pending criterion

## Implementation Plan

1. Step one
2. Step two

## Implementation Notes

These are notes with **bold** and *italic* text.

### Subsection

More detailed notes.`;

		const result = updateTaskDescription(content, "Updated description");

		expect(result).toContain("## Description\n\nUpdated description");
		expect(result).toContain("- [x] Completed criterion");
		expect(result).toContain("- [ ] Pending criterion");
		expect(result).toContain("1. Step one");
		expect(result).toContain("2. Step two");
		expect(result).toContain("**bold** and *italic*");
		expect(result).toContain("### Subsection");
		expect(result).not.toContain("Old description");
	});
});
