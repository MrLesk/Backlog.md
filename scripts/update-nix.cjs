// Resolve the pinned generator with the project's Node/npm build tools.
const { execFileSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

function main() {
	const [major, minor, patch] = process.versions.node.split(".").map(Number);
	if (major < 26 || (major === 26 && (minor < 12 || (minor === 12 && patch < 1)))) {
		throw new Error("Use patched Node.js 26.12.1 or later");
	}
	const cafile = process.env.SSL_CERT_FILE;
	if (!cafile) throw new Error("SSL_CERT_FILE must name a readable, nonempty filtered CA bundle");
	const certificates = readFileSync(cafile, "utf8").match(
		/-----BEGIN (TRUSTED )?CERTIFICATE-----[\s\S]+?-----END \1CERTIFICATE-----/g,
	);
	if (!certificates?.length) throw new Error("SSL_CERT_FILE contains no PEM certificates");
	for (const certificate of certificates) new X509Certificate(certificate);

	// Preserve npm's auth, registry and proxy configuration while enforcing certificate verification.
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "GIT_SSL_NO_VERIFY"),
	);
	env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
	let localVersion;
	try {
		localVersion = execFileSync("bun2nix", ["--version"], {
			env,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	if (localVersion !== undefined) {
		if (!/^bun2nix,? 2\.1\.2$/.test(localVersion)) throw new Error("Local bun2nix must report version 2.1.2");
		execFileSync("bun2nix", ["-o", "bun.nix"], { env, stdio: "inherit" });
		return;
	}

	const root = execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["root", "--global"], {
		env,
		encoding: "utf8",
		shell: process.platform === "win32",
	}).trim();
	const candidates = [
		path.join(root, "npm", "bin", "npm-cli.js"),
		path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
		path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
	];
	const cli = candidates.find((candidate) => existsSync(candidate));
	if (!cli) throw new Error("Cannot locate the native npm CLI");
	const npmVersion = execFileSync(process.execPath, [cli, "--version"], { env, encoding: "utf8" }).trim();
	const npmParts = /^(\d+)\.(\d+)\.(\d+)$/.exec(npmVersion);
	const npmMajor = Number(npmParts?.[1]);
	const npmMinor = Number(npmParts?.[2]);
	if (!npmParts || npmMajor < 12 || (npmMajor === 12 && npmMinor < 2)) throw new Error("Use npm 12.2.0 or later");
	execFileSync(
		process.execPath,
		[
			cli,
			"exec",
			"--yes",
			"--ignore-scripts",
			"--strict-ssl=true",
			`--cafile=${cafile}`,
			"--package=bun2nix@2.1.2",
			"--",
			"bun2nix",
			"-o",
			"bun.nix",
		],
		{ env, stdio: "inherit" },
	);
}

try {
	main();
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
