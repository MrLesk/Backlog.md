#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { join } = require("node:path");

const { getBinaryName } = require("./getBinaryName.cjs");

// Get the binary path
const binaryName = getBinaryName();
const binaryPath = join(__dirname, "bin", binaryName);

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
		console.error(`Please ensure you have the correct version for your platform (${process.platform}-${process.arch})`);
	} else {
		console.error("Failed to start backlog:", err);
	}
	process.exit(1);
});
