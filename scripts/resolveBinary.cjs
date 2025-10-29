function mapPlatform(platform = process.platform) {
	switch (platform) {
		case "win32":
			return "windows";
		case "darwin":
		case "linux":
			return platform;
		default:
			return platform;
	}
}

function mapArch(arch = process.arch) {
	switch (arch) {
		case "x64":
		case "arm64":
			return arch;
		default:
			return arch;
	}
}

function getPackageName(platform = process.platform, arch = process.arch) {
	return `backlog.md-${mapPlatform(platform)}-${mapArch(arch)}`;
}

function resolveBinaryPath(platform = process.platform, arch = process.arch) {
	const packageName = getPackageName(platform, arch);
	const binary = `backlog${platform === "win32" ? ".exe" : ""}`;

	try {
		return require.resolve(`${packageName}/${binary}`);
	} catch (error) {
		// Try baseline build as fallback for x64 platforms (Windows and Linux)
		if (arch === "x64" && (platform === "win32" || platform === "linux")) {
			const baselinePkg = `${packageName}-baseline`;
			try {
				return require.resolve(`${baselinePkg}/${binary}`);
			} catch (_baselineError) {
				// If baseline also fails, throw original error
				throw error;
			}
		}
		throw error;
	}
}

module.exports = { getPackageName, resolveBinaryPath };
