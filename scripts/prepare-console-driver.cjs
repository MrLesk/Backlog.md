// Windows qualification only. The ARM64 product is driven by this x64 tool under emulation.
const { createHash } = require("node:crypto");
const { appendFileSync, chmodSync, mkdirSync, writeFileSync } = require("node:fs");
const { setGlobalProxyFromEnv } = require("node:http");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { download, requirePatchedNode } = require("./prepare-bun-runtime.cjs");

async function main() {
	requirePatchedNode();
	if (process.platform !== "win32") throw new Error("This console driver preparation is for Windows runners");
	setGlobalProxyFromEnv();
	const version = "0.1.1";
	const bytes = await download(
		`https://github.com/microsoft/tui-test/releases/download/${version}/tui-test-x86_64-pc-windows-msvc.zip`,
	);
	// Official microsoft/tui-test 0.1.1 Windows archive digest.
	if (
		createHash("sha256").update(bytes).digest("hex") !==
		"1dfdc80c6394bb723c9f3e3cb919db5138f72c75855b8fba2051dadf89663856"
	) {
		throw new Error("Console driver archive checksum mismatch");
	}
	const directory = path.join(process.env.RUNNER_TEMP ?? tmpdir(), `backlog-tui-test-${version}`);
	mkdirSync(directory, { recursive: true });
	const archive = path.join(directory, "driver.zip");
	const executable = path.join(directory, "tui-test.exe");
	writeFileSync(archive, bytes);
	const extracted = spawnSync(
		"python",
		[
			"-c",
			"import pathlib,sys,zipfile; pathlib.Path(sys.argv[2]).write_bytes(zipfile.ZipFile(sys.argv[1]).read('tui-test.exe'))",
			archive,
			executable,
		],
		{ stdio: "inherit" },
	);
	if (extracted.status !== 0) throw new Error("Could not extract verified console driver");
	chmodSync(executable, 0o755);
	const revision = spawnSync(executable, ["--version"], { encoding: "utf8" });
	if (revision.status !== 0 || revision.stdout.trim() !== `tui-test ${version}`)
		throw new Error("Console driver version mismatch");
	if (process.env.GITHUB_PATH) appendFileSync(process.env.GITHUB_PATH, `${directory}\n`);
	console.log(`Verified Windows console driver: ${executable}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
