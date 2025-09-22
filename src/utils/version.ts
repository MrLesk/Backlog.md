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

	// In development, read from package.json relative to the source directory
	try {
		// First try relative to current working directory (for backward compatibility)
		let packageJson: { version?: string };
		try {
			packageJson = await Bun.file("package.json").json();
			if (packageJson.version) {
				return packageJson.version;
			}
		} catch {
			// If that fails, try relative to the source file location
			const { resolve, dirname } = await import("node:path");
			const { fileURLToPath } = await import("node:url");

			// Get the directory of this source file
			const currentFileUrl = import.meta.url;
			const currentFilePath = fileURLToPath(currentFileUrl);
			const sourceDir = dirname(currentFilePath);

			// Go up to project root (src/utils -> src -> project root)
			const projectRoot = resolve(sourceDir, "../..");
			const packageJsonPath = resolve(projectRoot, "package.json");

			packageJson = await Bun.file(packageJsonPath).json();
			return packageJson.version || "0.0.0";
		}
		return "0.0.0";
	} catch {
		return "0.0.0";
	}
}
