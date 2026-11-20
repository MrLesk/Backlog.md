import { describe, expect, it } from "bun:test";
import { parseTask } from "../markdown/parser.ts";
import { upsertTaskUpdatedDate } from "../utils/task-updated-date.ts";

describe("upsertTaskUpdatedDate", () => {
	const now = "2026-02-11T22:15:43Z";

	it("normalizes the creation time and replaces the update time on an edit", () => {
		const input = `---
id: task-1
title: Test Task
created_date: '2026-01-01 10:00'
updated_date: '2026-01-01 10:30'
labels: []
---

## Description

Body`;
		expect(upsertTaskUpdatedDate(input, now)).toBe(
			input.replace("2026-01-01 10:00", "2026-01-01T10:00:00Z").replace("2026-01-01 10:30", now),
		);
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
		const output = upsertTaskUpdatedDate(input, now);
		expect(output).toContain(`created_date: '2026-01-01T10:00:00Z'\nupdated_date: '${now}'\nlabels: []`);
	});

	it("inserts updated_date before frontmatter close when created_date is absent", () => {
		const input = `---
id: task-1
title: Test Task
labels: []
---

## Description

Body`;
		const output = upsertTaskUpdatedDate(input, now);

		expect(output).toContain(`labels: []\nupdated_date: '${now}'\n---`);
	});

	it("changes only root timestamps and preserves comments, line endings and body text", () => {
		const input =
			"---\r\nid: task-1\r\ncustom:\n  updated_date: original # nested\n" +
			"\"created_date\": '2026-01-01T01:30:45.987+02:00' # imported\r\n" +
			"updated_date: 'yesterday' # last edit\n---\r\nBody immediately after fence\n\r\n";
		expect(upsertTaskUpdatedDate(input, now)).toBe(
			input.replace("2026-01-01T01:30:45.987+02:00", "2025-12-31T23:30:45Z").replace("yesterday", now),
		);
	});

	it.each(["2026-01-01", "2026-02-31 12:00", "2026-01-01T10:00:00Z"])(
		"keeps the written creation value and its references for %s",
		(created) => {
			const input = `---\nid: task-1\ncreated_date: &birth '${created}' # imported\ncopy: *birth\n---\nBody`;
			expect(upsertTaskUpdatedDate(input, now)).toBe(input.replace("\ncopy:", `\nupdated_date: '${now}'\ncopy:`));
		},
	);

	it("refuses to change the value of a custom alias when normalizing a creation time", () => {
		const input = "---\nid: task-1\ncreated_date: &birth '2026-01-01 10:00'\naudit: *birth\n---\nBody";
		expect(() => upsertTaskUpdatedDate(input, now)).toThrow(/task-1: .*YAML reference/);
	});

	it("normalizes an aliased creation time without changing the source of the alias", () => {
		const input =
			'---\n{id: task-1, import: &birth !!timestamp "2026-01-01T01:30:45.987+02:00", created_date: *birth}\n---\nBody';
		const saved = upsertTaskUpdatedDate(input, now);
		expect(saved).toContain('import: &birth !!timestamp "2026-01-01T01:30:45.987+02:00"');
		expect(saved).toContain("created_date: 2025-12-31T23:30:45Z");
	});

	it("keeps comments on multiline and empty timestamp values", () => {
		const input =
			"---\r\nid: task-1\r\ncreated_date: |- # imported\r\n  2026-01-01 10:00\r\nupdated_date: >- # previous\n  yesterday\n---\r\nBody";
		const saved = upsertTaskUpdatedDate(input, now);
		expect(saved).toBe(
			input
				.replace("|- # imported\r\n  2026-01-01 10:00", "2026-01-01T10:00:00Z # imported")
				.replace(">- # previous\n  yesterday", `${now} # previous`),
		);
		const empty = "---\nid: task-1\nupdated_date: # previous\n---\nBody";
		expect(upsertTaskUpdatedDate(empty, now)).toBe(empty.replace("# previous", `'${now}' # previous`));
	});

	it("sets an explicitly empty update date without adding a second key", () => {
		const input = "---\nid: task-1\n? updated_date # previous\nlabels: []\n---\nBody";
		const saved = upsertTaskUpdatedDate(input, now);
		expect(saved).toContain("# previous");
		expect(parseTask(saved).updatedDate).toBe(now);
	});
});
