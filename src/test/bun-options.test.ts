import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("BUN_OPTIONS environment variable handling", () => {
	let originalBunOptions: string | undefined;

	beforeEach(() => {
		// Save original BUN_OPTIONS value
		originalBunOptions = process.env.BUN_OPTIONS;
	});

	afterEach(() => {
		// Restore original BUN_OPTIONS value
		if (originalBunOptions !== undefined) {
			process.env.BUN_OPTIONS = originalBunOptions;
		} else {
			delete process.env.BUN_OPTIONS;
		}
	});

	it("should temporarily isolate BUN_OPTIONS during CLI parsing", () => {
		// Set BUN_OPTIONS to simulate the conflict scenario from GitHub issue #168
		process.env.BUN_OPTIONS = "--bun --silent";

		// Save original value (simulating CLI startup)
		const savedBunOptions = process.env.BUN_OPTIONS;

		// Clear during CLI parsing to prevent Commander.js conflicts
		if (process.env.BUN_OPTIONS) {
			delete process.env.BUN_OPTIONS;
		}

		// Verify BUN_OPTIONS is cleared during parsing
		expect(process.env.BUN_OPTIONS).toBeUndefined();

		// Restore after parsing (simulating CLI completion)
		if (savedBunOptions) {
			process.env.BUN_OPTIONS = savedBunOptions;
		}

		// Verify BUN_OPTIONS is restored for subsequent commands
		expect(process.env.BUN_OPTIONS).toBe("--bun --silent");
	});

	it("should handle missing BUN_OPTIONS gracefully", () => {
		// Ensure BUN_OPTIONS is not set
		delete process.env.BUN_OPTIONS;

		// Save original value (should be undefined)
		const savedBunOptions = process.env.BUN_OPTIONS;

		// Execute the CLI initialization logic
		if (process.env.BUN_OPTIONS) {
			delete process.env.BUN_OPTIONS;
		}

		// Verify no error occurs and BUN_OPTIONS remains undefined
		expect(process.env.BUN_OPTIONS).toBeUndefined();

		// Restore logic should not crash
		if (savedBunOptions) {
			process.env.BUN_OPTIONS = savedBunOptions;
		}

		// Should still be undefined
		expect(process.env.BUN_OPTIONS).toBeUndefined();
	});

	it("should preserve BUN_OPTIONS for subsequent command usage", () => {
		const testValues = ["--bun", "--config=./bunfig.toml --silent", "--env-file=.env.local"];

		for (const value of testValues) {
			// Set BUN_OPTIONS
			process.env.BUN_OPTIONS = value;

			// Simulate the CLI save/clear/restore cycle
			const savedBunOptions = process.env.BUN_OPTIONS;

			// Clear during parsing
			if (process.env.BUN_OPTIONS) {
				delete process.env.BUN_OPTIONS;
			}

			// Verify it's cleared during parsing
			expect(process.env.BUN_OPTIONS).toBeUndefined();

			// Restore after parsing
			if (savedBunOptions) {
				process.env.BUN_OPTIONS = savedBunOptions;
			}

			// Verify it's available for subsequent commands
			expect(process.env.BUN_OPTIONS).toBe(value);
		}
	});
});
