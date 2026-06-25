import { readFileSync } from "node:fs";

// This will be replaced at build time for compiled executables
declare const __EMBEDDED_VERSION__: string | undefined;

/**
 * Get the version from package.json or embedded version (synchronous).
 *
 * Kept synchronous so it can be called from class constructors and module
 * initialization without introducing a top-level await. Top-level awaits in
 * modules that participate in import cycles (e.g. mcp/server.ts and its tool
 * modules) defer class initialization and cause "Cannot access X before
 * initialization" errors under Bun's isolated/parallel test runner.
 *
 * @returns The version string from package.json or embedded at build time
 */
export function getVersionSync(): string {
	// If this is a compiled executable with embedded version, use that
	if (typeof __EMBEDDED_VERSION__ !== "undefined") {
		return String(__EMBEDDED_VERSION__);
	}

	// In development, read from package.json
	try {
		const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
		return packageJson.version || "0.0.0";
	} catch {
		return "0.0.0";
	}
}

/**
 * Async wrapper around {@link getVersionSync} for existing async call sites.
 * @returns The version string from package.json or embedded at build time
 */
export async function getVersion(): Promise<string> {
	return getVersionSync();
}
