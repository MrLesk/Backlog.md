import { describe, expect, it } from "bun:test";
import { upsertTaskUpdatedDate } from "../utils/task-updated-date.ts";

describe("upsertTaskUpdatedDate", () => {
	it("replaces existing updated_date value", () => {
		const input = `---
id: task-1
title: Test Task
created_date: '2026-01-01 10:00'
updated_date: '2026-01-01 10:30'
labels: []
---

## Description

Body`;
		const output = upsertTaskUpdatedDate(input, "2026-02-11 22:15");

		expect(output).toContain("updated_date: '2026-02-11 22:15'");
		expect(output).not.toContain("updated_date: '2026-01-01 10:30'");
		expect(output).toContain("## Description");
	});

	it("inserts updated_date after created_date when missing", () => {
		const input = `---
id: task-1
title: Test Task
created_date: '2026-01-01 10:00'
labels: []
---

## Description

Body`;
		const output = upsertTaskUpdatedDate(input, "2026-02-11 22:15");

		expect(output).toContain("created_date: '2026-01-01 10:00'\nupdated_date: '2026-02-11 22:15'\nlabels: []");
	});

	it("inserts updated_date before frontmatter close when created_date is absent", () => {
		const input = `---
id: task-1
title: Test Task
labels: []
---

## Description

Body`;
		const output = upsertTaskUpdatedDate(input, "2026-02-11 22:15");

		expect(output).toContain("labels: []\nupdated_date: '2026-02-11 22:15'\n---");
	});

	it("preserves CRLF line endings", () => {
		const input =
			"---\r\nid: task-1\r\ntitle: Test Task\r\ncreated_date: '2026-01-01 10:00'\r\nlabels: []\r\n---\r\n\r\n## Description\r\n\r\nBody";
		const output = upsertTaskUpdatedDate(input, "2026-02-11 22:15");

		expect(output).toContain("\r\nupdated_date: '2026-02-11 22:15'\r\n");
		expect(output).toContain("\r\n## Description\r\n");
	});
});
