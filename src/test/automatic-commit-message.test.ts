import { describe, expect, it } from "bun:test";
import {
	AUTOMATIC_COMMIT_MESSAGE_REGION_END,
	AUTOMATIC_COMMIT_MESSAGE_REGION_START,
	buildAutomaticCommitMessage,
	formatAutomaticCommitSubject,
} from "../git/automatic-commit-message.ts";

describe("automatic commit messages", () => {
	it("keeps a single operation subject and stores its full message in one region", () => {
		const result = buildAutomaticCommitMessage("backlog: Update task BACK-1\nOperation detail");
		expect(result?.operations.map((operation) => operation.message)).toEqual([
			"backlog: Update task BACK-1\nOperation detail",
		]);
		expect(result?.message.startsWith("backlog: Update task BACK-1\n")).toBe(true);
		expect(result?.message).toContain(AUTOMATIC_COMMIT_MESSAGE_REGION_START);
		expect(result?.message).toContain(JSON.stringify("backlog: Update task BACK-1\nOperation detail"));
	});

	it("factors matching verbs and entities, elides at 72 characters, and counts mixed verbs", () => {
		expect(formatAutomaticCommitSubject(["backlog: Update task BACK-1", "Update task BACK-2"])).toBe(
			"backlog: Update tasks BACK-1, BACK-2",
		);
		const elided = formatAutomaticCommitSubject([
			"backlog: Update task BACK-12345678901234567890",
			"backlog: Update task BACK-22345678901234567890",
			"backlog: Update task BACK-32345678901234567890",
			"backlog: Update task BACK-42345678901234567890",
		]);
		expect(elided.length).toBeLessThanOrEqual(72);
		expect(elided).toContain("+3 more");
		expect(formatAutomaticCommitSubject(["backlog: Update task BACK-1", "backlog: Archive task BACK-2"])).toBe(
			"backlog: 2 changes",
		);
	});

	it("collapses duplicates regardless of position and preserves text outside the region", () => {
		const first = buildAutomaticCommitMessage("backlog: Update task BACK-1");
		if (!first) throw new Error("Expected initial message");
		const withHookText = first.message.replace(
			`${AUTOMATIC_COMMIT_MESSAGE_REGION_END}\n`,
			`${AUTOMATIC_COMMIT_MESSAGE_REGION_END}\nHook-Trailer: retained\n\n`,
		);
		const second = buildAutomaticCommitMessage("backlog: Update task BACK-2", withHookText);
		const duplicate = second && buildAutomaticCommitMessage("backlog: Update task BACK-1", second.message);
		expect(duplicate?.operations.map((operation) => operation.message)).toEqual([
			"backlog: Update task BACK-1",
			"backlog: Update task BACK-2",
		]);
		expect(duplicate?.message.match(/Hook-Trailer: retained/g)).toHaveLength(1);
		expect(duplicate?.message.endsWith("Hook-Trailer: retained\n\n")).toBe(true);
		expect(duplicate?.message.startsWith("backlog: Update tasks BACK-1, BACK-2\n")).toBe(true);
	});

	it("migrates version-one ID-prefixed draft operations into structured metadata", () => {
		const previous = [
			"DRAFT-1 - Create draft DRAFT-1",
			"",
			"Backlog-Operations-v1:",
			`- ${JSON.stringify("DRAFT-1 - Create draft DRAFT-1")}`,
			AUTOMATIC_COMMIT_MESSAGE_REGION_END,
			"",
		].join("\n");
		const result = buildAutomaticCommitMessage("DRAFT-2 - Create draft DRAFT-2", previous);

		expect(result?.message.startsWith("backlog: Create drafts DRAFT-1, DRAFT-2\n")).toBe(true);
		expect(result?.message).toContain("Backlog-Operations-v2:");
		expect(result?.message).not.toContain("Backlog-Operations-v1:");
	});

	it("fails closed for missing, duplicated, reversed, or malformed regions", () => {
		expect(buildAutomaticCommitMessage("Update task BACK-2", "Update task BACK-1\n")).toBeNull();
		expect(
			buildAutomaticCommitMessage(
				"Update task BACK-2",
				`Update task BACK-1\n${AUTOMATIC_COMMIT_MESSAGE_REGION_END}\n- "Update task BACK-1"\n${AUTOMATIC_COMMIT_MESSAGE_REGION_START}\n`,
			),
		).toBeNull();
		expect(
			buildAutomaticCommitMessage(
				"Update task BACK-2",
				`Update task BACK-1\n${AUTOMATIC_COMMIT_MESSAGE_REGION_START}\n- nope\n${AUTOMATIC_COMMIT_MESSAGE_REGION_END}\n`,
			),
		).toBeNull();
	});
});
