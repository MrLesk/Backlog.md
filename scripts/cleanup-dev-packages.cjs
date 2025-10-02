#!/usr/bin/env node

/**
 * Development package cleanup script
 * Removes conflicting platform packages during development setup
 * Only runs in development environments to avoid affecting CI/production
 */

const { rmSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

function isProductionEnvironment() {
	// Check for common CI/production environment indicators
	return !!(
		process.env.CI ||
		process.env.NODE_ENV === "production" ||
		process.env.BUILD_MODE === "production" ||
		process.env.GITHUB_ACTIONS ||
		process.env.GITLAB_CI ||
		process.env.JENKINS_URL ||
		process.env.BUILDKITE ||
		process.env.CIRCLECI
	);
}

function cleanupPlatformPackages() {
	const nodeModulesPath = resolve(__dirname, "../node_modules");

	if (!existsSync(nodeModulesPath)) {
		console.log("No node_modules directory found, skipping cleanup");
		return;
	}

	const platforms = ["darwin", "linux", "windows"];
	const architectures = ["x64", "arm64"];

	let removedCount = 0;

	for (const platform of platforms) {
		for (const arch of architectures) {
			const packageName = `backlog.md-${platform}-${arch}`;
			const packagePath = resolve(nodeModulesPath, packageName);

			if (existsSync(packagePath)) {
				try {
					rmSync(packagePath, { recursive: true, force: true });
					console.log(`✓ Removed development conflict: ${packageName}`);
					removedCount++;
				} catch (error) {
					console.warn(`⚠ Failed to remove ${packageName}: ${error.message}`);
				}
			}
		}
	}

	if (removedCount === 0) {
		console.log("✓ No conflicting platform packages found");
	} else {
		console.log(`✓ Cleaned up ${removedCount} platform package(s) for development`);
		console.log("  This enables the smart CLI to use TypeScript source files directly");
	}
}

function main() {
	console.log("🧹 Backlog.md Development Package Cleanup");

	// Skip cleanup in production/CI environments
	if (isProductionEnvironment()) {
		console.log("⏭ Skipping dev package cleanup in production/CI environment");
		return;
	}

	// Check if smart CLI is explicitly disabled
	if (process.env.BACKLOG_SMART_CLI === "false") {
		console.log("⏭ Skipping dev package cleanup (BACKLOG_SMART_CLI=false)");
		return;
	}

	try {
		cleanupPlatformPackages();
		console.log("✅ Development environment setup complete");
		console.log("   You can now use `bun link` for seamless development");
	} catch (error) {
		console.error(`❌ Cleanup failed: ${error.message}`);
		// Don't fail the postinstall process for cleanup issues
		process.exit(0);
	}
}

if (require.main === module) {
	main();
}

module.exports = { cleanupPlatformPackages, isProductionEnvironment };
