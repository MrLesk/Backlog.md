// Exercise the published Node launcher layout with the actual native artifact.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const [binary, version] = process.argv.slice(2);
if (!binary || !version) throw new Error("Usage: node scripts/smoke-packaged-build.cjs <binary> <version>");
const directory = mkdtempSync(path.join(tmpdir(), "backlog-packaged-smoke-"));
try {
	const root = path.join(directory, "node_modules/backlog.md");
	const platform = process.platform === "win32" ? "windows" : process.platform;
	const packageName = `backlog.md-${platform}-${process.arch}`;
	const packageDirectory = path.join(directory, "node_modules", packageName);
	mkdirSync(root, { recursive: true });
	mkdirSync(packageDirectory, { recursive: true });
	const installed = path.join(packageDirectory, `backlog${process.platform === "win32" ? ".exe" : ""}`);
	copyFileSync(path.resolve(binary), installed);
	chmodSync(installed, 0o755);
	writeFileSync(path.join(packageDirectory, "package.json"), JSON.stringify({ name: packageName, version }));
	copyFileSync(path.join(__dirname, "cli.cjs"), path.join(root, "cli.js"));
	copyFileSync(path.join(__dirname, "resolveBinary.cjs"), path.join(root, "resolveBinary.cjs"));
	// The released package removes type:module and owns the .bin entry with cli.js.
	writeFileSync(
		path.join(root, "package.json"),
		JSON.stringify({ name: "backlog.md", version, bin: { backlog: "cli.js" } }),
	);
	const run = (args, succeeds = true) => {
		const result = spawnSync(process.execPath, [path.join(root, "cli.js"), ...args], {
			cwd: directory,
			encoding: "utf8",
			timeout: 16000,
		});
		assert.ifError(result.error);
		assert.equal(result.signal, null, result.stderr);
		if (succeeds) assert.equal(result.status, 0, result.stderr);
		else assert.notEqual(result.status, 0, "Launcher lost the failed command exit code");
		return result.stdout;
	};
	assert.equal(run(["--version"]).trim(), version);
	run(["init", "Packaged smoke", "--defaults", "--no-git", "--integration-mode", "none"]);
	run(["task", "create", "Launcher task"]);
	const list = JSON.parse(run(["task", "list", "--json"]));
	assert.equal(list.tasks.length, 1);
	assert.equal(list.tasks[0].title, "Launcher task");
	run(["task", "edit", "BACK-999999", "--title", "Missing"], false);
	console.log(`Packaged launcher smoke passed for ${packageName}`);
} finally {
	rmSync(directory, { recursive: true, force: true });
}
