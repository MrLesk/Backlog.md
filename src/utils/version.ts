// This will be replaced at build time for compiled executables
declare const __EMBEDDED_VERSION__: string | undefined;

/**
 * Get the version from package.json or embedded version
 * @returns The version string from package.json or embedded at build time
 */
export async function getVersion(): Promise<string> {
	// If this is a compiled executable with embedded version, use that
	if (typeof __EMBEDDED_VERSION__ !== "undefined") {
		return String(__EMBEDDED_VERSION__);
	}

	return "0.0.0";
}
