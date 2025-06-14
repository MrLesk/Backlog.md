import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get the version from package.json
 * @returns The version string from package.json or a fallback version
 */
export async function getVersion(): Promise<string> {
	try {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const packageJsonPath = join(__dirname, "..", "..", "package.json");
		const packageJson = await Bun.file(packageJsonPath).json();
		return packageJson.version || "0.0.0";
	} catch {
		// Fallback version if package.json cannot be read
		// This might happen in compiled executables or unusual environments
		// Update this when the package version changes!
		return "0.1.4";
	}
}
