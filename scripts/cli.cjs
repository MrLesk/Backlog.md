#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { constants: osConstants } = require("node:os");
const { getCandidatePackageNames, isRosettaTranslated, resolveBinaryPath } = require("./resolveBinary.cjs");

function printInstallHelp() {
	console.error(`Detected: ${process.platform}-${process.arch} (Node ${process.version})`);
	if (process.platform === "darwin") {
		const rosetta = isRosettaTranslated();
		console.error(`Rosetta translation: ${rosetta ? "yes" : "no"}`);
		if (rosetta) {
			console.error(
				"Your Node/Bun runs as x64 under Rosetta on an Apple Silicon Mac, so the wrong CPU variant may have been installed.",
			);
		}
		console.error("To fix on macOS:");
		console.error("  - Compare architectures: `node -p process.arch` vs `uname -m` (arm64 = Apple Silicon hardware).");
		console.error(
			"  - Homebrew: use the native brew (`which brew`; /opt/homebrew = arm64, /usr/local = Intel), then `brew reinstall backlog-md`.",
		);
		console.error("  - npm on Apple Silicon: `arch -arm64 npm i -g backlog.md`");
		console.error("  - Bun on Apple Silicon: `arch -arm64 bun add -g backlog.md`");
		console.error("More details: https://github.com/MrLesk/Backlog.md#apple-silicon-macos");
	} else {
		console.error("Reinstall backlog.md so the platform package matching this architecture gets installed.");
	}
}

/**
 * Spawn/exec failures that indicate a missing or wrong-architecture binary.
 * macOS reports a wrong-arch Mach-O as EBADARCH (errno 86), which libuv has no
 * name for, so it surfaces as errno -86 ("Unknown system error -86").
 */
function isBinaryInstallError(error) {
	return error?.errno === -86 || error?.code === "EBADARCH" || error?.code === "ENOEXEC" || error?.code === "ENOENT";
}

function handleSpawnError(binaryPath, error) {
	if (isBinaryInstallError(error)) {
		console.error(`Cannot execute ${binaryPath} (${error.code ?? error.errno}).`);
		console.error("The binary is missing or was built for a different CPU architecture.");
		printInstallHelp();
	} else {
		console.error("Failed to start backlog:", error);
	}
	process.exit(1);
}

function main() {
	let binaryPath;
	try {
		binaryPath = resolveBinaryPath();
	} catch {
		console.error(`Binary package not installed for ${process.platform}-${process.arch}.`);
		console.error(`Tried packages: ${getCandidatePackageNames().join(", ")}`);
		printInstallHelp();
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

	// Spawn failures can surface as a synchronous throw (e.g. ENOEXEC) or as an 'error' event
	let child;
	try {
		child = spawn(binaryPath, cleanedArgs, {
			stdio: "inherit",
			windowsHide: true,
		});
	} catch (error) {
		handleSpawnError(binaryPath, error);
		return;
	}

	child.on("exit", (code, signal) => {
		if (signal === "SIGILL" || signal === "SIGTRAP") {
			// Typical symptom of running a binary built for the other CPU architecture
			console.error(`\nbacklog crashed with ${signal} (illegal instruction): ${binaryPath}`);
			console.error("The installed binary was likely built for a different CPU architecture.");
			printInstallHelp();
			process.exit(1);
		}
		if (signal) {
			const signalNumber = osConstants.signals[signal];
			process.exit(signalNumber ? 128 + signalNumber : 1);
		}
		process.exit(code ?? 1);
	});

	child.on("error", (error) => handleSpawnError(binaryPath, error));
}

if (require.main === module) main();

module.exports = { isBinaryInstallError };
