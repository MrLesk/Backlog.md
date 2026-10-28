const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const path = require("node:path");

const [artifact] = process.argv.slice(2);
if (!artifact || !process.env.BACKLOG_BROWSER_DRIVER) {
	throw new Error("Pass the compiled artifact and set BACKLOG_BROWSER_DRIVER to the pinned Playwright package");
}
const { chromium } = require(process.env.BACKLOG_BROWSER_DRIVER);
const binary = path.resolve(artifact);
async function main() {
	const directory = await mkdtemp(path.join(tmpdir(), "backlog-native-browser-"));
	const cli = (args) => {
		const child = spawnSync(binary, args, { cwd: directory, encoding: "utf8", timeout: 16000 });
		assert.ifError(child.error);
		assert.equal(child.status, 0, child.stderr);
		return child.stdout;
	};
	cli(["init", "Native browser", "--defaults", "--no-git", "--integration-mode", "none"]);
	cli(["task", "create", "Initial native task"]);
	const port = await new Promise((resolve, reject) => {
		const socket = createServer();
		socket.on("error", reject);
		socket.listen(0, "127.0.0.1", () => {
			const address = socket.address();
			socket.close(() => resolve(address.port));
		});
	});
	const server = spawn(binary, ["browser", "--no-open", "--non-interactive", "--port", String(port)], {
		cwd: directory,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let diagnostics = "";
	server.stdout.on("data", (data) => {
		diagnostics += data;
	});
	server.stderr.on("data", (data) => {
		diagnostics += data;
	});
	const closed = new Promise((resolve, reject) => {
		server.once("exit", (code, signal) => resolve({ code, signal }));
		server.once("error", reject);
	});
	let browser;
	let page;
	try {
		const url = `http://127.0.0.1:${port}`;
		await waitForServer(url, server);
		browser = await chromium.launch({ headless: true });
		page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
		page.setDefaultTimeout(10000);
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(url);
		await page.getByText("Initial native task", { exact: true }).waitFor();
		await page.getByRole("button", { name: "+ New Task", exact: true }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByPlaceholder("Enter task title").fill("Browser-created native task");
		await dialog.locator("textarea").first().fill("Created through Chromium");
		await dialog.getByRole("button", { name: "Create", exact: true }).click();
		await dialog.waitFor({ state: "hidden" });
		await page.getByText("Browser-created native task", { exact: true }).click();
		await dialog.getByRole("button", { name: "Edit", exact: true }).click();
		await dialog.locator("textarea").first().fill("Edited through Chromium");
		await dialog.getByRole("button", { name: "Save", exact: true }).click();
		await dialog.getByText("Edited through Chromium", { exact: true }).waitFor();
		const task = JSON.parse(cli(["task", "list", "--json"])).tasks.find(
			(item) => item.title === "Browser-created native task",
		);
		assert.ok(task, "The browser did not persist its task");
		assert.equal(JSON.parse(cli(["task", "view", task.id, "--json"])).task.description, "Edited through Chromium");
		await page.screenshot({ path: `${binary}.browser-edit.png`, fullPage: true });
		await dialog.getByRole("button", { name: "Close modal" }).click();
		cli(["task", "edit", task.id, "--title", "Watched native task"]);
		await page.getByText("Watched native task", { exact: true }).waitFor();
		await page.screenshot({ path: `${binary}.browser-board.png`, fullPage: true });
		assert.deepEqual(errors, [], "Browser JavaScript errors");
	} finally {
		await page?.screenshot({ path: `${binary}.browser-final.png`, fullPage: true }).catch(console.error);
		await browser?.close();
		server.kill("SIGTERM");
		const timer = setTimeout(() => server.kill("SIGKILL"), 8000);
		try {
			assert.deepEqual(await closed, { code: 0, signal: null }, diagnostics);
		} finally {
			clearTimeout(timer);
			await rm(directory, { recursive: true, force: true });
		}
	}
	console.log("Compiled browser create/edit/watch and graceful shutdown passed");
}

async function waitForServer(url, child) {
	const deadline = Date.now() + 10000;
	while (Date.now() < deadline) {
		assert.equal(child.exitCode, null, "Browser server exited before readiness");
		try {
			if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
		} catch {
			// The child may not have bound its port yet.
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error("Browser server did not become ready");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
