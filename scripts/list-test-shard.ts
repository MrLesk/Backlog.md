import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const testFileSuffixes = [
	".test.ts",
	".test.tsx",
	".test.js",
	".test.jsx",
	"_test.ts",
	"_test.tsx",
	"_test.js",
	"_test.jsx",
];

function parsePositiveInteger(value: string | undefined, name: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new Error(`${name} must be a positive integer.`);
	}
	return parsed;
}

function toPosixPath(path: string): string {
	return path.split(sep).join("/");
}

function isBunTestFile(path: string): boolean {
	const isTestSuffix = testFileSuffixes.some((suffix) => path.endsWith(suffix));
	const isInTestsDirectory = path.split("/").includes("__tests__") && /\.(ts|tsx|js|jsx)$/.test(path);
	return isTestSuffix || isInTestsDirectory;
}

function collectTestFiles(directory: string): string[] {
	const files: string[] = [];

	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...collectTestFiles(absolutePath));
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		const relativePath = toPosixPath(relative(process.cwd(), absolutePath));
		if (isBunTestFile(relativePath)) {
			files.push(`./${relativePath}`);
		}
	}

	return files.sort();
}

try {
	const shard = parsePositiveInteger(process.argv[2], "shard");
	const totalShards = parsePositiveInteger(process.argv[3], "totalShards");

	if (shard > totalShards) {
		throw new Error("shard must be less than or equal to totalShards.");
	}

	const selectedFiles = collectTestFiles("src").filter((_, index) => index % totalShards === shard - 1);
	if (selectedFiles.length > 0) {
		process.stdout.write(`${selectedFiles.join("\n")}\n`);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
