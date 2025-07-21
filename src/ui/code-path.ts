/* Code path detection and styling utilities */

/**
 * Regex patterns for detecting code paths in backticks
 */
export const CODE_PATH_PATTERNS = {
	// Matches `src/cli.ts`, `package.json`, `/full/path/file.ts`
	BACKTICKED_PATH: /`([^`]+)`/g,
	// Matches file extensions
	FILE_EXTENSION: /\.[a-zA-Z0-9]+$/,
	// Matches path separators
	PATH_SEPARATOR: /[/\\]/,
} as const;

/**
 * Detect if a backticked string is likely a file path
 */
export function isCodePath(content: string): boolean {
	// Has file extension OR contains path separator
	return CODE_PATH_PATTERNS.FILE_EXTENSION.test(content) || CODE_PATH_PATTERNS.PATH_SEPARATOR.test(content);
}

/**
 * Extract all code paths from text
 */
export function extractCodePaths(text: string): string[] {
	const matches = text.match(CODE_PATH_PATTERNS.BACKTICKED_PATH);
	if (!matches) return [];

	return matches
		.map((match) => match.slice(1, -1)) // Remove backticks
		.filter(isCodePath);
}

/**
 * Style a code path for blessed display
 */
export function styleCodePath(path: string): string {
	return `{gray-fg}\`${path}\`{/gray-fg}`;
}

/**
 * Transform text to style code paths and place them on separate lines
 */
export function transformCodePaths(text: string): string {
	if (!text) return "";

	// Split into lines to preserve existing line breaks
	const lines = text.split("\n");
	const result: string[] = [];

	for (const line of lines) {
		let transformedLine = line;
		const codePaths = extractCodePaths(line);

		if (codePaths.length === 0) {
			// No code paths, add line as-is
			result.push(transformedLine);
			continue;
		}

		// Check if line contains only a code path (possibly with minimal surrounding text)
		const lineWithoutPaths = line.replace(/`[^`]+`/g, "").trim();
		const isIsolatedPath = codePaths.length === 1 && lineWithoutPaths.length < 10;

		if (isIsolatedPath) {
			// Style the code path in place
			for (const path of codePaths) {
				transformedLine = transformedLine.replace(`\`${path}\``, styleCodePath(path));
			}
			result.push(transformedLine);
		} else {
			// Extract code paths to separate lines
			let workingLine = transformedLine;
			const pathsToExtract: string[] = [];

			for (const path of codePaths) {
				const backticked = `\`${path}\``;
				if (workingLine.includes(backticked)) {
					// Remove from line and collect for separate placement, clean up extra spaces
					workingLine = workingLine.replace(backticked, " ").replace(/\s+/g, " ").trim();
					pathsToExtract.push(path);
				}
			}

			// Add the line without code paths (if not empty)
			if (workingLine.length > 0) {
				result.push(workingLine);
			}

			// Add each code path on its own line
			for (const path of pathsToExtract) {
				result.push(styleCodePath(path));
			}
		}
	}

	return result.join("\n");
}

/**
 * Simple styling for plain text (without blessed tags)
 */
export function transformCodePathsPlain(text: string): string {
	if (!text) return "";

	return text.replace(CODE_PATH_PATTERNS.BACKTICKED_PATH, (match, path) => {
		if (isCodePath(path)) {
			return `\`${path}\``;
		}
		return match;
	});
}
