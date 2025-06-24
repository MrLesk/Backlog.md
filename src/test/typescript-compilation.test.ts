import { describe, expect, test } from "bun:test";
import { spawn } from "bun";

describe("TypeScript Compilation", () => {
	test(
		"should compile all TypeScript files without errors",
		async () => {
			// Use TypeScript compiler to check for compilation errors
			const result = await spawn(
				["bunx", "tsc", "--noEmit", "--project", "tsconfig.json"],
				{
					cwd: process.cwd(),
				},
			);

			const exitCode = await result.exited;

			if (exitCode !== 0) {
				// Get the error output
				const stderr = await new Response(result.stderr).text();
				console.error("TypeScript compilation errors:", stderr);
			}

			expect(exitCode).toBe(0);
		},
		{ timeout: 30000 },
	);

	test(
		"should build CLI without import errors",
		async () => {
			// Test that the CLI can be built successfully
			const result = await spawn(
				["bun", "build", "src/cli.ts", "--target", "bun"],
				{
					cwd: process.cwd(),
				},
			);

			const exitCode = await result.exited;

			if (exitCode !== 0) {
				const stderr = await new Response(result.stderr).text();
				console.error("CLI build errors:", stderr);
			}

			expect(exitCode).toBe(0);
		},
		{ timeout: 15000 },
	);
});
