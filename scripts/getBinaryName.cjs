function getBinaryName(platform = process.platform, arch = process.arch) {
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
			throw new Error(`Unsupported platform: ${platform}`);
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
			throw new Error(`Unsupported architecture: ${arch}`);
	}

	// Windows executables have .exe extension
	if (platform === "win32") {
		binaryName += ".exe";
	}

	return binaryName;
}

module.exports = { getBinaryName };
