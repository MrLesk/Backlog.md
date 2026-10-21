import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { trustedCertificates } from "../../scripts/filter-trusted-cas.cjs";
import { withGitFetchTrust } from "../git/certificate-trust.ts";
import { GitOperations } from "../git/operations.ts";

const fixtures = join(import.meta.dir, "fixtures/certificate-trust");
const roots: string[] = [];
const originalEnvironment = { ...process.env };
afterEach(async () => {
	for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
	Object.assign(process.env, originalEnvironment);
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function temporary() {
	const root = await mkdtemp(join(tmpdir(), "backlog-git-trust-test-"));
	roots.push(root);
	return root;
}
async function git(root: string, ...args: string[]) {
	const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
	const [code, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (code !== 0) throw new Error(stderr);
	return stdout.trim();
}

test("the shared filter removes all incident variants and preserves private certificates", async () => {
	const incidents = (await Bun.file(join(fixtures, "compromised-cas.json")).json()).certificates;
	const privateCA = await readFile(join(fixtures, "registry-ca.pem"), "utf8");
	expect(
		trustedCertificates([...incidents.map((certificate: { pem: string }) => certificate.pem), privateCA, privateCA]),
	).toEqual([privateCA.trim()]);
	expect(() => trustedCertificates(incidents.map((certificate: { pem: string }) => certificate.pem))).toThrow(
		"empty TLS trust",
	);
});

test("native-supported Ed448 authorities survive Bun's unsupported-key decoder without relaxing malformed input", async () => {
	const certificate = await readFile(join(fixtures, "unsupported-key-ca.pem"), "utf8");
	expect(trustedCertificates([certificate])).toEqual([certificate.trim()]);
	expect(() => trustedCertificates(["not a certificate"])).toThrow("no PEM certificates");
	expect(() => trustedCertificates(["-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----"])).toThrow();
});

test("an explicit private CA stays exclusive and URL-specific verification retains usernames without putting passwords in child settings", async () => {
	const root = await temporary();
	const privateCA = join(fixtures, "registry-ca.pem");
	await withGitFetchTrust(
		"https://test-user:test-secret@example.invalid/repository",
		root,
		privateCA,
		undefined,
		async (environment) => {
			const certificates = trustedCertificates([await readFile(environment.GIT_SSL_CAINFO as string, "utf8")]);
			expect(certificates).toEqual([(await readFile(privateCA, "utf8")).trim()]);
			const count = Number(process.env.GIT_CONFIG_COUNT ?? 0);
			expect(environment[`GIT_CONFIG_KEY_${count}`]).toBe(
				"http.https://test-user@example.invalid/repository.sslVerify",
			);
			expect(environment[`GIT_CONFIG_VALUE_${count}`]).toBe("true");
			expect(environment.GIT_CONFIG_COUNT).toBe(String(count + 2));
			expect(JSON.stringify(environment)).not.toContain("test-secret");
		},
	);
});

test("default native Git trust remains nonempty after filtering", async () => {
	const root = await temporary();
	await withGitFetchTrust("https://example.invalid/repository", root, undefined, undefined, async (environment) => {
		const certificates = trustedCertificates([await readFile(environment.GIT_SSL_CAINFO as string, "utf8")]);
		expect(certificates.length).toBeGreaterThan(0);
	});
});

test("explicit empty Git CA files fail closed rather than gaining default trust", async () => {
	const root = await temporary();
	for (const key of Object.keys(process.env)) {
		if (/^git_ssl_ca(info|path)$/i.test(key)) delete process.env[key];
	}
	await git(root, "init", "--quiet");
	await git(root, "config", "remote.origin.url", "https://localhost:1/fixture");
	await git(root, "config", "http.sslCAInfo", "");
	expect(
		await git(root, "config", "--null", "--path", "--get-urlmatch", "http.sslCAInfo", "https://localhost:1/fixture"),
	).toBe("\0");
	await expect(new GitOperations(root).fetch()).rejects.toThrow("Configured Git CA file is empty");
	await git(root, "config", "http.sslCAInfo", join(fixtures, "registry-ca.pem"));
	process.env.GIT_SSL_CAINFO = "";
	await expect(new GitOperations(root).fetch()).rejects.toThrow("Configured Git CA file is empty");
});

test.each(process.platform === "win32" ? ["canonical", "lowercase"] : ["canonical"])(
	"native Git HTTPS fetch preserves private trust and auth but rejects both incident paths (%s)",
	async (style) => {
		const root = await temporary();
		const incidents = (await Bun.file(join(fixtures, "compromised-cas.json")).json()).certificates;
		const selected = join(root, "selected-ca.pem");
		await writeFile(
			selected,
			[
				await readFile(join(fixtures, "registry-ca.pem"), "utf8"),
				await readFile(join(fixtures, "unsupported-key-ca.pem"), "utf8"),
				...incidents.map((certificate: { pem: string }) => certificate.pem),
			].join("\n"),
		);
		// Isolate the same Git configuration for every chain. Schannel's fixture revocation
		// switch is Windows-only; production keeps the caller's revocation policy.
		for (const key of Object.keys(process.env)) {
			if (/^(git_config_(?:count|key_\d+|value_\d+)|git_ssl_cainfo|git_ssl_capath|https?_proxy|all_proxy)$/i.test(key))
				delete process.env[key];
		}
		const variant = (name: string) =>
			style === "lowercase" &&
			/^GIT_(?:SSL_CA(?:INFO|PATH)|SSL_NO_VERIFY|CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+))$/.test(name)
				? name.toLowerCase()
				: name;
		const inherited: Record<string, string> = {
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: join(root, "global-gitconfig"),
			GIT_CONFIG_COUNT: "1",
			GIT_CONFIG_KEY_0: "http.extraHeader",
			GIT_CONFIG_VALUE_0: "X-Backlog-Fixture: preserved",
			GIT_SSL_NO_VERIFY: "false",
			NO_PROXY: "localhost,127.0.0.1",
			no_proxy: "localhost,127.0.0.1",
		};
		if (style === "lowercase") {
			inherited.GIT_SSL_CAINFO = selected;
			inherited.GIT_SSL_CAPATH = join(root, "selected-ca-directory");
			await mkdir(inherited.GIT_SSL_CAPATH);
		}
		Object.assign(
			process.env,
			Object.fromEntries(Object.entries(inherited).map(([key, value]) => [variant(key), value])),
		);
		await writeFile(process.env.GIT_CONFIG_GLOBAL as string, "");
		await git(root, "init", "--quiet");
		if (process.platform === "win32") {
			await git(root, "config", "http.sslBackend", "schannel");
			await git(root, "config", "http.schannelCheckRevoke", "false");
		}
		for (const chain of [
			"registry-server.pem",
			...(process.platform === "linux" ? ["unsupported-key-server.pem"] : []),
			"incident-server-emudhra.pem",
			"incident-server-aaa.pem",
		]) {
			let requests = 0;
			let header: string | string[] | undefined;
			const server = createServer(
				{ key: await readFile(join(fixtures, "registry-server-key.pem")), cert: await readFile(join(fixtures, chain)) },
				(request, response) => {
					requests++;
					header = request.headers["x-backlog-fixture"];
					response.writeHead(404);
					response.end("fixture repository not found");
				},
			);
			await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
			try {
				const address = server.address();
				if (!address || typeof address === "string") throw new Error("Expected loopback server address");
				const url = `https://test-user:test-secret@localhost:${address.port}/repository`;
				const configuredURL = `https://test-user@localhost:${address.port}/repository`;
				await git(root, "config", "remote.origin.url", url);
				await git(
					root,
					"config",
					`http.${configuredURL}.sslCAInfo`,
					style === "lowercase" ? join(fixtures, "unsupported-key-ca.pem") : selected,
				);
				await git(root, "config", `http.${configuredURL}.sslVerify`, "false");
				const operations = new GitOperations(root);
				const internals = operations as unknown as {
					execGit: (args: string[], options?: unknown) => Promise<{ stdout: string; stderr: string }>;
				};
				const execute = internals.execGit.bind(operations);
				let fetchError: unknown;
				internals.execGit = async (args, options) => {
					try {
						return await execute(args, options);
					} catch (error) {
						if (args[0] === "fetch") fetchError = error;
						throw error;
					}
				};
				await operations.fetch().catch((error) => {
					fetchError ??= error;
				});
				const diagnostic = `${chain}: ${String(fetchError)}`;
				if (!(fetchError instanceof Error) || /timeout|could not spawn/i.test(diagnostic)) {
					throw new Error(`Expected a completed Git certificate rejection or fixture 404: ${diagnostic}`);
				}
				if (requests !== (chain.startsWith("incident-") ? 0 : 1)) {
					throw new Error(`Unexpected HTTP request count ${requests}: ${diagnostic}`);
				}
				if (chain.startsWith("incident-")) expect(diagnostic).toMatch(/certificate|SSL|issuer|trust|schannel|revok/i);
				else {
					expect(diagnostic).toMatch(/not found|404/i);
					expect(header).toBe("preserved");
				}
				expect(process.env[variant("GIT_CONFIG_COUNT")]).toBe("1");
				expect(process.env[variant("GIT_SSL_NO_VERIFY")]).toBe("false");
			} finally {
				server.closeAllConnections();
				await new Promise<void>((resolve) => server.close(() => resolve()));
			}
		}
	},
	20000,
);
