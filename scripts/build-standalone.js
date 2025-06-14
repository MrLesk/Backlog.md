#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";

const PLATFORMS = [
	{ os: "linux", arch: "x64", bunTarget: "bun-linux-x64" },
	{ os: "linux", arch: "arm64", bunTarget: "bun-linux-arm64" },
	{ os: "darwin", arch: "x64", bunTarget: "bun-darwin-x64" },
	{ os: "darwin", arch: "arm64", bunTarget: "bun-darwin-arm64" },
	{ os: "win32", arch: "x64", bunTarget: "bun-windows-x64" },
	// Windows ARM64 is not yet supported by Bun's compiler
	// { os: "win32", arch: "arm64", bunTarget: "bun-windows-arm64" },
];

async function runCommand(command, args, env = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			env: { ...process.env, ...env },
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Command failed with exit code ${code}`));
			}
		});

		child.on("error", reject);
	});
}

async function buildForPlatform(targetPlatform) {
	const { os, arch, bunTarget } = targetPlatform;
	const outputName = os === "win32" ? "backlog.exe" : "backlog";
	const outputPath = join("dist", `backlog-${os}-${arch}`, outputName);

	console.log(`Building for ${os}-${arch}...`);

	try {
		await mkdir(dirname(outputPath), { recursive: true });

		// Read version from package.json
		const packageJson = JSON.parse(await readFile("package.json", "utf-8"));
		const version = packageJson.version;

		// Build standalone executable
		const buildArgs = [
			"build",
			"--compile",
			"--external",
			"blessed",
			"--target",
			bunTarget,
			"--define",
			`__EMBEDDED_VERSION__="${version}"`,
			"--outfile",
			outputPath,
			"src/cli.ts",
		];

		// Add Windows-specific flags
		if (os === "win32") {
			buildArgs.push("--windows-hide-console");
		}

		await runCommand("bun", buildArgs);
		console.log(`✓ Built ${outputPath}`);

		return { platform: `${os}-${arch}`, path: outputPath, os, arch };
	} catch (error) {
		console.error(`✗ Failed to build for ${os}-${arch}:`, error.message);
		return null;
	}
}

async function createNpmWrapper() {
	console.log("Creating npm wrapper package...");

	// Create a wrapper that detects platform and runs the appropriate binary
	const wrapperContent = `#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { platform, arch } from 'os';
import { accessSync, constants } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getBinaryPath() {
  const os = platform();
  const architecture = arch();
  
  // Map Node.js platform names to our binary names
  const platformMap = {
    'darwin': 'darwin',
    'linux': 'linux',
    'win32': 'win32'
  };
  
  const archMap = {
    'x64': 'x64',
    'arm64': 'arm64'
  };
  
  const mappedOs = platformMap[os];
  const mappedArch = archMap[architecture];
  
  if (!mappedOs || !mappedArch) {
    throw new Error(\`Unsupported platform: \${os}-\${architecture}\`);
  }
  
  const binaryName = os === 'win32' ? 'backlog.exe' : 'backlog';
  const binaryPath = join(__dirname, 'bin', \`backlog-\${mappedOs}-\${mappedArch}\`, binaryName);
  
  try {
    accessSync(binaryPath, constants.X_OK);
    return binaryPath;
  } catch (error) {
    throw new Error(\`Binary not found for platform \${mappedOs}-\${mappedArch} at \${binaryPath}\`);
  }
}

try {
  const binaryPath = getBinaryPath();
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    env: process.env
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  child.on('error', (err) => {
    console.error('Failed to run backlog:', err.message);
    process.exit(1);
  });
} catch (error) {
  console.error(error.message);
  console.error('\\nPlease report this issue at: https://github.com/MrLesk/Backlog.md/issues');
  process.exit(1);
}
`;

	await mkdir("dist", { recursive: true });
	await writeFile("dist/cli.js", wrapperContent);

	// Update package.json to point to the wrapper
	const packageJson = JSON.parse(await readFile("package.json", "utf-8"));
	packageJson.bin = {
		backlog: "dist/cli.js",
	};

	// Add files field to include all binaries
	packageJson.files = ["dist/", "README.md", "LICENSE"];

	await writeFile("dist/package.json", JSON.stringify(packageJson, null, 2));

	// Copy other necessary files
	await runCommand("cp", ["README.md", "LICENSE", "dist/"]);
}

async function buildAll() {
	console.log("Building standalone executables for all platforms...\n");

	const currentPlatform = `${platform()}-${arch()}`;
	console.log(`Current platform: ${currentPlatform}\n`);

	// For local builds, only build for current platform
	const isCI = process.env.CI === "true";
	const targetPlatforms = isCI ? PLATFORMS : PLATFORMS.filter((p) => p.os === platform() && p.arch === arch());

	const results = await Promise.all(targetPlatforms.map(buildForPlatform));

	const successful = results.filter(Boolean);
	console.log(`\n✅ Successfully built ${successful.length} executables`);

	if (successful.length === 0) {
		throw new Error("No executables were built successfully");
	}

	// Create npm wrapper
	await createNpmWrapper();

	console.log("\n📦 Package ready for distribution");
}

// Run the build
buildAll().catch((error) => {
	console.error("Build failed:", error);
	process.exit(1);
});
