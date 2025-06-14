import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// This will be replaced at build time for compiled executables
declare const __EMBEDDED_VERSION__: string | undefined;

/**
 * Get the version from package.json or embedded version
 * @returns The version string from package.json or embedded at build time
 */
export async function getVersion(): Promise<string> {
	// If this is a compiled executable with embedded version, use that
	if (typeof __EMBEDDED_VERSION__ !== "undefined") {
		return __EMBEDDED_VERSION__;
	}

	const __dirname = dirname(fileURLToPath(import.meta.url));

	// Try multiple possible locations for package.json
	const possiblePaths = [
		join(__dirname, "..", "..", "package.json"), // Development (src/utils/version.ts -> package.json)
		join(__dirname, "..", "package.json"), // npm package (cli/cli.js -> package.json)
		join(__dirname, "package.json"), // If somehow in root
	];

	for (const packageJsonPath of possiblePaths) {
		try {
			const packageJson = await Bun.file(packageJsonPath).json();
			if (packageJson.version) {
				return packageJson.version;
			}
		} catch {
			// Try next path
		}
	}

	throw new Error("Could not find package.json or version field");
}
