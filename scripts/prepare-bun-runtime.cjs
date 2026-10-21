// Download with Node's patched TLS verifier, then verify the release digest before extraction.
// Bun 1.4.3's native cross-compile downloader still trusts the compromised eMudhra chains.
const { createHash } = require("node:crypto");
const { appendFileSync, chmodSync, mkdirSync, writeFileSync } = require("node:fs");
const https = require("node:https");
const { setGlobalProxyFromEnv } = require("node:http");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const version = "1.4.3";
// SHA-256 digests published on the official bun-v1.4.3 GitHub release.
const assets = {
	"bun-darwin-arm64": ["bun-darwin-aarch64.zip", "80afd4c069b46a6fa8f3ec520bebc750a7843e4a8d5b9583d29ad436c00a3403"],
	"bun-darwin-x64": ["bun-darwin-x64.zip", "62660e6438eb872278877acca77e1152d5d031324df368d4a81b428211489d2d"],
	"bun-linux-arm64": ["bun-linux-aarch64.zip", "efa9813da5ed72423bf847f916e8d2c47c0d776add972354026a75e10da9aa21"],
	"bun-linux-x64": ["bun-linux-x64.zip", "3e730528d89775f03f87f05c06787c4df4099d0a37f3f252e7b829cb23816e18"],
	"bun-windows-arm64": ["bun-windows-aarch64.zip", "5e8f142ef722cbc9f67dc068a166e46ee72be8307b38cac7186589d2face668f"],
	"bun-windows-x64": ["bun-windows-x64.zip", "0bf84e808552beea67bf1202a287a35c6c825d837b287b3f8e9dd513dba35d3d"],
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
