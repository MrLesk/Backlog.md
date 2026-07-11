import { createServer } from "node:net";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const executablePath = process.argv[2];
const expectedVersion = process.argv[3];

if (!executablePath || !expectedVersion) {
	throw new Error("Usage: bun scripts/smoke-compiled-build.ts <executable-path> <expected-version>");
}

const executable = resolve(executablePath);
const operationTimeout = process.platform === "win32" ? 16000 : 8000;

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

type CapturedFailure = { error: unknown };
type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

function settle<T>(operation: Promise<T>): Promise<Outcome<T>> {
	return operation.then(
		(value) => ({ ok: true, value }),
		(error: unknown) => ({ ok: false, error }),
	);
}

async function unwrapOutcome<T>(operation: Promise<Outcome<T>>, label: string): Promise<T> {
	const outcome = await withTimeout(operation, label, operationTimeout, () => "");
	if (!outcome.ok) {
		throw outcome.error;
	}
	return outcome.value;
}

function throwAfterCleanup(
	label: string,
	operationFailure: CapturedFailure | undefined,
	cleanupFailures: Error[],
	diagnostics = "",
): void {
	const failures = [
		...(operationFailure ? [operationFailure.error] : []),
		...cleanupFailures,
	].map((error) => (error instanceof Error ? error : new Error(String(error))));
	if (failures.length === 0) {
		return;
	}

	const message = `${label} failed.${diagnostics ? `\n${diagnostics}` : ""}`;
	if (failures.length === 1) {
		throw new Error(message, { cause: failures[0] });
	}
	throw new AggregateError(failures, message);
}

async function captureCleanupFailure(cleanupFailures: Error[], label: string, cleanup: () => Promise<void>): Promise<void> {
	try {
		await cleanup();
	} catch (error) {
		cleanupFailures.push(new Error(label, { cause: error }));
	}
}

function waitForTransportClose(transport: StdioClientTransport): Promise<void> {
	if (transport.pid === null) {
		return Promise.resolve();
	}

	const previousOnClose = transport.onclose;
	return new Promise((resolveClose, reject) => {
		transport.onclose = () => {
			try {
				previousOnClose?.();
				resolveClose();
			} catch (error) {
				reject(error);
			}
		};
	});
}

function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs: number, details: () => string): Promise<T> {
	return new Promise((resolveOperation, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`${label} timed out after ${timeoutMs}ms.${details()}`));
		}, timeoutMs);

		operation.then(
			(value) => {
				clearTimeout(timer);
				resolveOperation(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function findAvailablePort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Unable to allocate test port.")));
				return;
			}
			server.close(() => resolvePort(address.port));
		});
	});
}

async function run(executableAndArgs: string[]): Promise<string> {
	const child = Bun.spawn(executableAndArgs, {
		stderr: "pipe",
		stdout: "pipe",
	});
	const stdoutResult = settle(new Response(child.stdout).text());
	const stderrResult = settle(new Response(child.stderr).text());
	let childExited = false;
	const exited = settle(child.exited).then((outcome) => {
		childExited = true;
		return outcome;
	});

	let operationFailure: CapturedFailure | undefined;
	try {
		const exitCode = await unwrapOutcome(exited, `${executableAndArgs.join(" ")} exit`);
		assert(exitCode === 0, `${executableAndArgs.join(" ")} exited with ${exitCode}.`);
	} catch (error) {
		operationFailure = { error };
	}

	const cleanupFailures: Error[] = [];
	if (!childExited) {
		await captureCleanupFailure(cleanupFailures, `Failed to stop ${executableAndArgs.join(" ")}.`, async () => {
			child.kill("SIGKILL");
		});
	}
	await captureCleanupFailure(cleanupFailures, `${executableAndArgs.join(" ")} did not reach terminal state.`, async () => {
		await unwrapOutcome(exited, `${executableAndArgs.join(" ")} close`);
	});

	let stdout = "";
	let stderr = "";
	await captureCleanupFailure(cleanupFailures, `Failed to read ${executableAndArgs.join(" ")} stdout.`, async () => {
		stdout = await unwrapOutcome(stdoutResult, `${executableAndArgs.join(" ")} stdout`);
	});
	await captureCleanupFailure(cleanupFailures, `Failed to read ${executableAndArgs.join(" ")} stderr.`, async () => {
		stderr = await unwrapOutcome(stderrResult, `${executableAndArgs.join(" ")} stderr`);
	});
	throwAfterCleanup(
		`Compiled CLI command ${executableAndArgs.join(" ")}`,
		operationFailure,
		cleanupFailures,
		[`stdout:\n${stdout}`, `stderr:\n${stderr}`].join("\n"),
	);
	return stdout;
}

async function waitForHttp(url: string, isServerExited: () => boolean, timeoutMs: number): Promise<Response> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;

	while (Date.now() < deadline) {
		if (isServerExited()) {
			throw new Error("Compiled browser server exited before responding.");
		}

		try {
			const remainingMs = Math.max(1, deadline - Date.now());
			const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(1000, remainingMs)) });
			if (response.ok) {
				return response;
			}
			lastError = new Error(`Unexpected status ${response.status}`);
		} catch (error) {
			lastError = error;
		}

		await sleep(100);
	}

	throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
	return fetch(url, { ...init, signal: AbortSignal.timeout(operationTimeout) });
}

const helpOutput = await run([executable, "--help"]);
assert(helpOutput.includes("Backlog.md - Project management CLI"), "Compiled CLI help is missing its title.");

const versionOutput = (await run([executable, "--version"])).trim();
assert(versionOutput === expectedVersion, `Expected compiled version ${expectedVersion}, received ${versionOutput}.`);

const port = await findAvailablePort();
const browserServer = Bun.spawn(
	[executable, "browser", "--no-open", "--non-interactive", "--port", String(port)],
	{
		cwd: process.cwd(),
		stderr: "pipe",
		stdout: "ignore",
	},
);
let browserServerExited = false;
const browserStderr = settle(new Response(browserServer.stderr).text());
const browserExited = settle(browserServer.exited).then((outcome) => {
	browserServerExited = true;
	return outcome;
});

let browserFailure: CapturedFailure | undefined;
try {
	const baseUrl = `http://127.0.0.1:${port}`;
	const htmlResponse = await waitForHttp(`${baseUrl}/`, () => browserServerExited, operationTimeout);
	assert(
		htmlResponse.headers.get("cache-control") === "no-store, max-age=0, must-revalidate",
		"Compiled browser HTML is missing its no-store cache policy.",
	);

	const html = await htmlResponse.text();
	const stylesheetPath = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
	const scriptPath = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
	const faviconPath = html.match(/<link rel="icon"[^>]*href="([^"]+)"/)?.[1];

	assert(/^\/chunk-[a-z0-9]+\.css$/.test(stylesheetPath ?? ""), `Invalid stylesheet path: ${stylesheetPath}`);
	assert(/^\/chunk-[a-z0-9]+\.js$/.test(scriptPath ?? ""), `Invalid script path: ${scriptPath}`);
	assert(/^\/favicon-[a-z0-9]+\.png$/.test(faviconPath ?? ""), `Invalid favicon path: ${faviconPath}`);

	const stylesheetResponse = await fetchWithTimeout(`${baseUrl}${stylesheetPath}`);
	assert(stylesheetResponse.status === 200, `Stylesheet returned ${stylesheetResponse.status}.`);
	assert(
		stylesheetResponse.headers.get("content-type")?.includes("text/css"),
		`Unexpected stylesheet content type: ${stylesheetResponse.headers.get("content-type")}`,
	);
	const stylesheet = await stylesheetResponse.text();
	assert(stylesheet.includes(".flex{display:flex}"), "Compiled stylesheet is missing Tailwind utilities.");
	assert(stylesheet.includes(".wmde-markdown"), "Compiled stylesheet is missing Markdown editor styles.");

	const scriptResponse = await fetchWithTimeout(`${baseUrl}${scriptPath}`, { method: "HEAD" });
	assert(scriptResponse.status === 200, `Browser script returned ${scriptResponse.status}.`);
	assert(
		scriptResponse.headers.get("content-type")?.includes("text/javascript"),
		`Unexpected script content type: ${scriptResponse.headers.get("content-type")}`,
	);

	const faviconResponse = await fetchWithTimeout(`${baseUrl}${faviconPath}`, { method: "HEAD" });
	assert(faviconResponse.status === 200, `Favicon returned ${faviconResponse.status}.`);
	assert(
		faviconResponse.headers.get("content-type")?.includes("image/png"),
		`Unexpected favicon content type: ${faviconResponse.headers.get("content-type")}`,
	);
} catch (error) {
	browserFailure = { error };
}

const browserCleanupFailures: Error[] = [];
if (!browserServerExited) {
	await captureCleanupFailure(browserCleanupFailures, "Failed to stop compiled browser server.", async () => {
		browserServer.kill("SIGKILL");
	});
}
await captureCleanupFailure(browserCleanupFailures, "Compiled browser server did not exit cleanly.", async () => {
	await unwrapOutcome(browserExited, "compiled browser close");
});
let browserStderrOutput = "";
await captureCleanupFailure(browserCleanupFailures, "Failed to read compiled browser stderr.", async () => {
	browserStderrOutput = await unwrapOutcome(browserStderr, "compiled browser stderr");
});
throwAfterCleanup(
	"Compiled browser smoke check",
	browserFailure,
	browserCleanupFailures,
	browserStderrOutput ? `stderr:\n${browserStderrOutput}` : "",
);

let mcpStderr = "";
const transport = new StdioClientTransport({
	command: executable,
	args: ["mcp", "start", "--cwd", process.cwd(), "--debug"],
	cwd: process.cwd(),
	stderr: "pipe",
});
transport.stderr?.on("data", (chunk) => {
	mcpStderr += chunk.toString();
});

const client = new Client({ name: "Compiled MCP Smoke Test", version: "1.0.0" }, { capabilities: {} });
let mcpFailure: CapturedFailure | undefined;
try {
	await withTimeout(client.connect(transport), "MCP connect", operationTimeout, () => ` stderr:\n${mcpStderr}`);
	const tools = await withTimeout(client.listTools(), "MCP listTools", operationTimeout, () => ` stderr:\n${mcpStderr}`);
	assert(tools.tools.some((tool) => tool.name === "task_list"), "Compiled MCP server is missing task_list.");
	const resources = await withTimeout(
		client.listResources(),
		"MCP listResources",
		operationTimeout,
		() => ` stderr:\n${mcpStderr}`,
	);
	assert(
		resources.resources.some((resource) => resource.uri === "backlog://workflow/overview"),
		"Compiled MCP server is missing its workflow overview resource.",
	);
} catch (error) {
	mcpFailure = { error };
}

const transportClosed = settle(waitForTransportClose(transport));
const mcpCleanupFailures: Error[] = [];
await captureCleanupFailure(mcpCleanupFailures, "Failed to close compiled MCP client.", async () => {
	await client.close();
});
await captureCleanupFailure(mcpCleanupFailures, "Compiled MCP child process did not close.", async () => {
	await unwrapOutcome(transportClosed, "MCP child close");
});
throwAfterCleanup(
	"Compiled MCP smoke check",
	mcpFailure,
	mcpCleanupFailures,
	mcpStderr ? `stderr:\n${mcpStderr}` : "",
);

console.log(`Compiled build smoke checks passed for ${executable}.`);
