import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { GitOperations, isGitRepository } from "../git/operations.ts";

describe("Git Operations", () => {
	describe("isGitRepository", () => {
		it("should return true for current directory (which is a git repo)", async () => {
			const result = await isGitRepository(process.cwd());
			expect(result).toBe(true);
		});

		it("should return false for /tmp directory", async () => {
			const result = await isGitRepository("/tmp");
			expect(result).toBe(false);
		});

		it("should return false when the working directory cannot be spawned", async () => {
			const result = await isGitRepository(join(process.cwd(), "tmp", "missing-git-cwd"));
			expect(result).toBe(false);
		});
	});

	describe("GitOperations instantiation", () => {
		it("should create GitOperations instance", () => {
			const git = new GitOperations(process.cwd());
			expect(git).toBeDefined();
		});
	});

	describe("isNetworkError", () => {
		const git = new GitOperations(process.cwd());
		const isNetworkError = (git as unknown as { isNetworkError(error: unknown): boolean }).isNetworkError.bind(git);

		it("should recognize classic network errors", () => {
			expect(isNetworkError(new Error("Could not resolve host: github.com"))).toBe(true);
			expect(isNetworkError(new Error("Connection refused"))).toBe(true);
			expect(isNetworkError(new Error("Network is unreachable"))).toBe(true);
			expect(isNetworkError(new Error("Connection timed out"))).toBe(true);
			expect(isNetworkError(new Error("Operation timed out"))).toBe(true);
			expect(isNetworkError(new Error("Temporary failure in name resolution"))).toBe(true);
		});

		it("should recognize SSL-related errors", () => {
			expect(isNetworkError(new Error("OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443"))).toBe(true);
			expect(isNetworkError(new Error("SSL handshake failed"))).toBe(true);
			expect(isNetworkError(new Error("TLS handshake timeout"))).toBe(true);
			expect(isNetworkError(new Error("ssl_connect error"))).toBe(true);
		});

		it("should return false for non-network errors", () => {
			expect(isNetworkError(new Error("merge conflict"))).toBe(false);
			expect(isNetworkError(new Error("fatal: not a git repository"))).toBe(false);
			expect(isNetworkError(new Error("bad config file"))).toBe(false);
		});

		it("should handle string errors", () => {
			expect(isNetworkError("SSL_ERROR_SYSCALL in connection")).toBe(true);
			expect(isNetworkError("not a network problem")).toBe(false);
		});
	});

	// Note: Skipping integration tests that require git repository setup
	// These tests can be enabled for local development but may timeout in CI
});
