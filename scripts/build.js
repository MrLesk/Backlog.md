#!/usr/bin/env node

import { spawn } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { dirname, join } from "node:path";

const isWindows = platform() === "win32";
const outDir = "cli";
const indexFile = join(outDir, "index.js");
const executableName = isWindows ? "backlog.exe" : "backlog";
const executablePath = join(outDir, executableName);

async function runCommand(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			shell: isWindows,
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Command failed with exit code ${code}`));
			}
		});

		child.on("error", reject);
	});
}

async function build() {
	try {
		console.log("Building CLI...");

		// Ensure output directory exists
		await mkdir(dirname(indexFile), { recursive: true });

		// Build JavaScript bundle
		console.log("Building JavaScript bundle...");
		await runCommand("bun", ["build", "src/cli.ts", "--external", "blessed", "--outdir", outDir, "--target", "bun"]);

		// Create index.js wrapper
		console.log("Creating index.js wrapper...");
		const indexContent = isWindows ? 'import("./cli.js");' : '#!/usr/bin/env bun\nimport("./cli.js");';

		await writeFile(indexFile, indexContent);

		// Make executable on Unix systems
		if (!isWindows) {
			await chmod(indexFile, "755");
		}

		// Build compiled executable
		console.log("Building compiled executable...");
		await runCommand("bun", ["build", "src/cli.ts", "--compile", "--external", "blessed", "--outfile", executablePath]);

		// Make executable on Unix systems
		if (!isWindows) {
			await chmod(executablePath, "755");
		}

		console.log("Build completed successfully!");
		console.log(`Executable: ${executablePath}`);
		console.log(`JS Bundle: ${indexFile}`);
	} catch (error) {
		console.error("Build failed:", error.message);
		process.exit(1);
	}
}

build();
