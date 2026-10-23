import { expect, test } from "bun:test";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import type { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:tls";

const fixtures = join(import.meta.dir, "fixtures/certificate-trust");

test.concurrent("native fetch preserves a configured private HTTPS proxy", async () => {
	const root = await mkdtemp(join(tmpdir(), "backlog-git-user-trust-"));
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key]) => !/^(git_.+|https?_proxy|all_proxy|no_proxy|ssl_cert_.+|curl_ca_bundle)$/i.test(key),
		),
	);
	Object.assign(env, {
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_CONFIG_GLOBAL: join(root, "global-gitconfig"),
		GIT_PROXY_SSL_CAINFO: join(fixtures, "registry-ca.pem"),
	});
	const git = async (...args: string[]) => {
		const child = Bun.spawn(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe" });
		const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
		expect(code, stderr).toBe(0);
	};
	let requests = 0;
	const sockets = new Set<Socket>();
	const server = createServer(
		{
			key: await readFile(join(fixtures, "registry-server-key.pem")),
			cert: await readFile(join(fixtures, "registry-server.pem")),
		},
		(socket) =>
			socket.once("data", () => {
				requests++;
				socket.end("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
			}),
	);
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
	});
	server.on("tlsClientError", () => {});
	let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
	try {
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("Expected proxy port");
		await git("init", "--quiet");
		await appendFile(
			join(root, ".git/config"),
			`\n[remote "origin"]\nurl = http://fixture-origin.invalid/repository\n[http]\nproxy = https://localhost:${address.port}\n${process.platform === "win32" ? "sslBackend = openssl\n" : ""}`,
		);
		const module = new URL("../git/operations.ts", import.meta.url).href;
		child = Bun.spawn(
			[
				process.execPath,
				"-e",
				`import { GitOperations } from ${JSON.stringify(module)}; await new GitOperations(process.cwd()).fetch();`,
			],
			{ cwd: root, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
		);
		const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
		// The fixture's HTTP response proves TLS and proxy configuration were accepted.
		expect(requests).toBe(1);
		expect(code).not.toBe(0);
		expect(stderr).toContain("502");
	} finally {
		if (child?.exitCode === null) child.kill();
		for (const socket of sockets) socket.destroy();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await rm(root, { recursive: true, force: true });
	}
});
