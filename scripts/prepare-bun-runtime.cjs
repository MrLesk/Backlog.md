// Download with Node's patched TLS verifier, then verify the release digest before extraction.
const { createHash } = require("node:crypto");
const { appendFileSync, chmodSync, mkdirSync, writeFileSync } = require("node:fs");
const https = require("node:https");
const { setGlobalProxyFromEnv } = require("node:http");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const version = "1.4.4";
// SHA-256 digests published on the official bun-v1.4.4 GitHub release.
const assets = {
	"bun-darwin-arm64": ["bun-darwin-aarch64.zip", "c240d7f0ccb90c263a849fcdb09b7ee62630d921348ed6aafda86b9d577bc510"],
	"bun-darwin-x64": ["bun-darwin-x64.zip", "50a3491f73abc2fe81673171a85762d3bc2cc1680ccecadd983de99adf77977e"],
	"bun-linux-arm64": ["bun-linux-aarch64.zip", "baa6bb36f51d6e58561e02bbea825038a9df454f673d6d776e8bbf86f8c7850e"],
	"bun-linux-x64": ["bun-linux-x64.zip", "bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c"],
	"bun-windows-arm64": ["bun-windows-aarch64.zip", "2d57a0eec0cb44d95c918c3f9734f60455a1306ae5085d76fc68f44e3ee30d09"],
	"bun-windows-x64": ["bun-windows-x64.zip", "cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5"],
};

function download(url, redirects = 0) {
	return new Promise((resolve, reject) => {
		const request = https.get(url, (response) => {
			if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
				response.resume();
				const destination = new URL(response.headers.location, url);
				if (redirects >= 5 || destination.protocol !== "https:") {
					reject(new Error("Unexpected Bun release redirect"));
					return;
				}
				resolve(download(destination, redirects + 1));
				return;
			}
			if (response.statusCode !== 200) {
				response.resume();
				reject(new Error(`Bun release download returned HTTP ${response.statusCode}`));
				return;
			}
			const chunks = [];
			response.on("data", (chunk) => chunks.push(chunk));
			response.on("end", () => resolve(Buffer.concat(chunks)));
			response.on("error", reject);
		});
		request.setTimeout(120_000, () => request.destroy(new Error("Bun release download timed out")));
		request.on("error", reject);
	});
}

async function main() {
	const [major, minor, patch] = process.versions.node.split(".").map(Number);
	if (major < 26 || (major === 26 && (minor < 12 || (minor === 12 && patch < 1)))) {
		throw new Error("Use patched Node.js 26.12.1 or later");
	}
	if (process.env.BUN_VERSION && process.env.BUN_VERSION !== version) {
		throw new Error("Update the verified Bun release digests together with BUN_VERSION");
	}
	// Honor explicitly configured HTTPS proxies while retaining Node's TLS verification.
	setGlobalProxyFromEnv();
	const host = `bun-${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
	const target = process.argv[2] ?? host;
	if (!Object.hasOwn(assets, target)) throw new Error(`Unsupported Bun target: ${target}`);
	const [asset, checksum] = assets[target];
	const bytes = await download(`https://github.com/oven-sh/bun/releases/download/bun-v${version}/${asset}`);
	if (createHash("sha256").update(bytes).digest("hex") !== checksum) throw new Error("Bun release checksum mismatch");
	const directory = path.join(process.env.RUNNER_TEMP ?? tmpdir(), `backlog-bun-${version}`, target);
	mkdirSync(directory, { recursive: true });
	const archive = path.join(directory, asset);
	const executable = path.join(directory, target.includes("windows") ? "bun.exe" : "bun");
	writeFileSync(archive, bytes);
	const member = `${asset.slice(0, -4)}/${path.basename(executable)}`;
	const extracted = spawnSync(
		process.platform === "win32" ? "python" : "python3",
		[
			"-c",
			"import pathlib,sys,zipfile; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))",
			archive,
			member,
			executable,
		],
		{ stdio: "inherit" },
	);
	if (extracted.status !== 0) throw new Error("Could not extract the verified Bun executable");
	chmodSync(executable, 0o755);
	if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `BACKLOG_BUILD_EXECUTABLE_PATH=${executable}\n`);
	if (target === host && process.env.GITHUB_PATH) appendFileSync(process.env.GITHUB_PATH, `${directory}\n`);
	console.log(`Verified Bun ${version} for ${target}: ${executable}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
