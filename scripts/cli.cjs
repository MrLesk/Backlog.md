#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { resolveBinaryPath } = require("./resolveBinary.cjs");

let binaryPath;
try {
	binaryPath = resolveBinaryPath();
} catch {
	console.error(`Binary package not installed for ${process.platform}-${process.arch}.`);
	process.exit(1);
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
		console.error(`Please ensure you have the correct version for your platform (${process.platform}-${process.arch})`);
	} else {
		console.error("Failed to start backlog:", err);
	}
	process.exit(1);
});
