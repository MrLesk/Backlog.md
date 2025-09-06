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

// Clean up unexpected args some global shims pass (e.g. bun) like the binary path itself
const rawArgs = process.argv.slice(2);
const cleanedArgs = rawArgs.filter((arg) => {
	if (arg === binaryPath) return false;
	// Filter any accidental deep path to our platform package binary
	try {
		const pattern = /node_modules[/\\]backlog\.md-(darwin|linux|windows)-[^/\\]+[/\\]backlog(\.exe)?$/i;
		return !pattern.test(arg);
	} catch {
		return true;
	}
});

// Spawn the binary with cleaned arguments
const child = spawn(binaryPath, cleanedArgs, {
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
