const { execFileSync } = require("node:child_process");

function getPackageName(platform = process.platform, arch = process.arch) {
	return `backlog.md-${platform === "win32" ? "windows" : platform}-${arch}`;
}

/**
 * Package names to try, in order. On macOS the native arch comes first and the
 * sibling arch is a fallback: Rosetta can make Node/Bun report x64 on Apple
 * Silicon (or install only one variant), and macOS can still run whichever
 * darwin binary is actually present.
 */
function getCandidatePackageNames(platform = process.platform, arch = process.arch) {
	const candidates = [getPackageName(platform, arch)];
	if (platform === "darwin" && (arch === "arm64" || arch === "x64")) {
		candidates.push(getPackageName(platform, arch === "arm64" ? "x64" : "arm64"));
	}
	return candidates;
}

/** True when the current process runs under Rosetta 2 translation on macOS. */
function isRosettaTranslated(platform = process.platform) {
	if (platform !== "darwin") return false;
	try {
		return execFileSync("sysctl", ["-in", "sysctl.proc_translated"], { encoding: "utf8" }).trim() === "1";
	} catch {
		return false;
	}
}

function resolveBinaryPath(platform = process.platform, arch = process.arch, resolver = require.resolve) {
	const binary = `backlog${platform === "win32" ? ".exe" : ""}`;
	let firstError;
	for (const packageName of getCandidatePackageNames(platform, arch)) {
		try {
			return resolver(`${packageName}/${binary}`);
		} catch (error) {
			firstError ??= error;
		}
	}
	throw firstError;
}

module.exports = { getPackageName, getCandidatePackageNames, isRosettaTranslated, resolveBinaryPath };
