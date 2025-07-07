import { describe, expect, it } from "bun:test";
import { GitOperations } from "../git/operations.ts";

describe("Git Isolation Tests", () => {
	it("should have retry logic method available", () => {
		const gitOps = new GitOperations(".");
		expect(typeof gitOps.retryGitOperation).toBe("function");
	});

	it("should have reset index method available", () => {
		const gitOps = new GitOperations(".");
		expect(typeof gitOps.resetIndex).toBe("function");
	});

	it("should have commit staged changes method available", () => {
		const gitOps = new GitOperations(".");
		expect(typeof gitOps.commitStagedChanges).toBe("function");
	});
});
