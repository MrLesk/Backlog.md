#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { getPackageName } = require("./resolveBinary.cjs");

// Platform-specific packages to uninstall
const platformPackages = [
	"backlog.md-linux-x64",
	"backlog.md-linux-arm64",
	"backlog.md-darwin-x64",
	"backlog.md-darwin-arm64",
	"backlog.md-windows-x64",
];

// Detect package manager
const packageManager =
	process.env.npm_config_user_agent?.split("/")[0] || "npm";

console.log("Cleaning up platform-specific packages...");

// Try to uninstall all platform packages
for (const pkg of platformPackages) {
	const args =
		packageManager === "bun" ? ["remove", "-g", pkg] : ["uninstall", "-g", pkg];

	const child = spawn(packageManager, args, {
		stdio: "pipe", // Don't show output to avoid spam
		windowsHide: true,
	});

	child.on("exit", (code) => {
		if (code === 0) {
			console.log(`✓ Cleaned up ${pkg}`);
		}
		// Silently ignore failures - package might not be installed
	});
}

console.log("Platform package cleanup completed.");
