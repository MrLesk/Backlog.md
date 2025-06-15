#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { join } = require("node:path");
const fs = require("node:fs");
const https = require("node:https");
const { createWriteStream, chmodSync } = require("node:fs");

// Determine the correct binary based on platform and architecture
function getBinaryName() {
	const platform = process.platform;
	const arch = process.arch;

	let binaryName = "backlog-";

	// Map Node.js platform names to Bun target names
	switch (platform) {
		case "linux":
			binaryName += "bun-linux-";
			break;
		case "darwin":
			binaryName += "bun-darwin-";
			break;
		case "win32":
			binaryName += "bun-windows-";
			break;
		default:
			console.error(`Unsupported platform: ${platform}`);
			process.exit(1);
	}

	// Map Node.js arch names to Bun target names
	switch (arch) {
		case "x64":
			binaryName += "x64";
			break;
		case "arm64":
			binaryName += "arm64";
			break;
		default:
			console.error(`Unsupported architecture: ${arch}`);
			process.exit(1);
	}

	// Windows executables have .exe extension
	if (platform === "win32") {
		binaryName += ".exe";
	}

	return binaryName;
}

// Download binary from GitHub releases
async function downloadBinary(binaryName, binaryPath) {
	const packageJson = require(join(__dirname, "package.json"));
	const version = packageJson.version;
	const url = `https://github.com/MrLesk/Backlog.md/releases/download/v${version}/${binaryName}`;

	console.log(`Downloading ${binaryName} for your platform...`);
	console.log("This is a one-time download.");

	return new Promise((resolve, reject) => {
		https
			.get(url, (response) => {
				if (response.statusCode === 302 || response.statusCode === 301) {
					// Follow redirect
					https
						.get(response.headers.location, (redirectResponse) => {
							if (redirectResponse.statusCode !== 200) {
								reject(new Error(`Failed to download: ${redirectResponse.statusCode}`));
								return;
							}

							const file = createWriteStream(binaryPath);
							redirectResponse.pipe(file);

							file.on("finish", () => {
								file.close();
								// Make executable on Unix
								if (process.platform !== "win32") {
									chmodSync(binaryPath, 0o755);
								}
								console.log("Download complete!");
								resolve();
							});
						})
						.on("error", reject);
				} else if (response.statusCode !== 200) {
					reject(new Error(`Failed to download: ${response.statusCode}`));
				} else {
					const file = createWriteStream(binaryPath);
					response.pipe(file);

					file.on("finish", () => {
						file.close();
						// Make executable on Unix
						if (process.platform !== "win32") {
							chmodSync(binaryPath, 0o755);
						}
						console.log("Download complete!");
						resolve();
					});
				}
			})
			.on("error", reject);
	});
}

// Main execution
async function main() {
	const binaryName = getBinaryName();
	const binDir = join(__dirname, ".bin");
	const binaryPath = join(binDir, binaryName);

	// Create bin directory if it doesn't exist
	if (!fs.existsSync(binDir)) {
		fs.mkdirSync(binDir, { recursive: true });
	}

	// Check if binary exists
	if (!fs.existsSync(binaryPath)) {
		try {
			await downloadBinary(binaryName, binaryPath);
		} catch (err) {
			console.error("Failed to download binary:", err.message);
			console.error("Please download manually from: https://github.com/MrLesk/Backlog.md/releases");
			process.exit(1);
		}
	}

	// Spawn the binary with all arguments
	const child = spawn(binaryPath, process.argv.slice(2), {
		stdio: "inherit",
		windowsHide: true,
	});

	// Handle exit
	child.on("exit", (code) => {
		process.exit(code || 0);
	});

	// Handle errors
	child.on("error", (err) => {
		if (err.code === "ENOENT") {
			console.error(`Binary not found: ${binaryPath}`);
			console.error(`Please delete ${binDir} and try again.`);
		} else {
			console.error("Failed to start backlog:", err);
		}
		process.exit(1);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
