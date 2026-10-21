import { afterEach, expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:https";
import { connect, createServer as createTCPServer, type Socket } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createServer as createTLSServer, getCACertificates } from "node:tls";
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

test("trusted PEM certificates retain distinct auxiliary trust policy and exclude incident keys", async () => {
	const trusted = (await readFile(join(fixtures, "trusted-registry-ca.pem"), "utf8")).trim();
	const rejected = (await readFile(join(fixtures, "rejected-registry-ca.pem"), "utf8")).trim();
	const ordinary = (await readFile(join(fixtures, "registry-ca.pem"), "utf8")).trim();
	expect(trustedCertificates([trusted, rejected, ordinary, trusted])).toEqual([trusted, rejected, ordinary]);
	const incidents = await readFile(join(fixtures, "trusted-compromised-cas.pem"), "utf8");
	expect(trustedCertificates([trusted, incidents])).toEqual([trusted]);
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

test("native CA directories preserve ordinary files, hash gaps, and incident filtering without promoting directory trust", async () => {
	for (const name of Object.keys(process.env)) {
		if (/^(?:git_config(?:_.+)?|git_ssl_.+|git_proxy_ssl_.+|https?_proxy|all_proxy|no_proxy)$/i.test(name))
			delete process.env[name];
	}
	const incidents = (await Bun.file(join(fixtures, "compromised-cas.json")).json()).certificates;
	const privateCA = await readFile(join(fixtures, "registry-ca.pem"), "utf8");
	const cases = [
		{ name: "private.crt", chain: "registry-server.pem" },
		// OpenSSL's subject hash for the fixture authority. GnuTLS also reads ordinary names.
		{ name: "81ee7702.0", chain: "registry-server.pem" },
		{ name: "81ee7702.1", chain: "registry-server.pem" },
		{ name: "81ee7702.1", chain: "registry-server.pem", prefix: "blocked" },
		{ name: "81ee7702.1", chain: "registry-server.pem", prefix: "non-pem" },
		{ name: "81ee7702.1", chain: "registry-server.pem", prefix: "empty" },
		{ name: "81ee7702.2", chain: "registry-server.pem", prefix: "blocked" },
		{ name: "81ee7702.2", chain: "registry-server.pem", prefix: "blocked-non-pem" },
		{ name: "81ee7702.2", chain: "registry-server.pem", prefix: "multiple" },
		{ name: "00000000.0", chain: "registry-server.pem" },
		{ name: "private.crt", chain: "registry-server.pem", defaultFile: true },
		{ name: "81ee7702.0", chain: "registry-server.pem", authority: "trusted-registry-ca.pem" },
		{ name: "81ee7702.0", chain: "registry-server.pem", authority: "rejected-registry-ca.pem" },
		{ name: "private.crt", chain: "registry-server.pem", authority: "trusted-registry-ca.pem", file: true },
		{ name: "private.crt", chain: "registry-server.pem", authority: "rejected-registry-ca.pem", file: true },
		{
			name: "private.crt",
			chain: "registry-server.pem",
			authority: "trusted-registry-ca.pem",
			secondAuthority: "rejected-registry-ca.pem",
			file: true,
		},
		{
			name: "private.crt",
			chain: "registry-server.pem",
			authority: "rejected-registry-ca.pem",
			secondAuthority: "trusted-registry-ca.pem",
			file: true,
		},
		{ name: "private.crt", chain: "incident-server-emudhra.pem", incident: true, file: true },
		{ name: "private.crt", chain: "incident-server-aaa.pem", incident: true, file: true },
		{ name: "private.crt", chain: "incident-server-emudhra.pem" },
		{ name: "private.crt", chain: "incident-server-aaa.pem" },
	];
	let trustedFileAccepted = false;
	for (const fixture of cases) {
		const root = await temporary();
		const selected = join(root, "selected-ca-directory");
		await mkdir(selected);
		let authority = fixture.incident
			? await readFile(join(fixtures, "trusted-compromised-cas.pem"), "utf8")
			: fixture.authority
				? await readFile(join(fixtures, fixture.authority), "utf8")
				: privateCA;
		if (fixture.secondAuthority) authority += `\n${await readFile(join(fixtures, fixture.secondAuthority), "utf8")}`;
		await writeFile(join(selected, fixture.name), authority);
		if (process.platform !== "win32" && fixture.name === "81ee7702.0") {
			await symlink(join(root, "missing-ca.pem"), join(selected, "missing-ca.pem"));
		}
		if (fixture.prefix) {
			const contents =
				fixture.prefix === "blocked" || fixture.prefix === "blocked-non-pem"
					? incidents[0].pem
					: fixture.prefix === "multiple"
						? `${await readFile(join(fixtures, "unsupported-key-ca.pem"), "utf8")}\n${trustedCertificates(getCACertificates("system"))[0]}`
						: fixture.prefix === "empty"
							? ""
							: "not a PEM authority";
			await writeFile(join(selected, "81ee7702.0"), contents);
			if (fixture.prefix === "blocked-non-pem") {
				await writeFile(join(selected, "81ee7702.1"), "not a PEM authority");
			}
		}
		await writeFile(join(selected, "incident-roots.pem"), incidents.map((ca: { pem: string }) => ca.pem).join("\n"));
		await writeFile(join(selected, "unrelated.txt"), "not a PEM authority");
		process.env.GIT_CONFIG_NOSYSTEM = "1";
		process.env.GIT_CONFIG_GLOBAL = join(root, "global-gitconfig");
		await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
		await git(root, "init", "--quiet");
		if (process.platform === "win32") await git(root, "config", "http.sslBackend", "openssl");
		if (fixture.file) {
			await git(root, "config", "http.sslCAInfo", join(selected, fixture.name));
		} else {
			if (!fixture.defaultFile) await git(root, "config", "http.sslCAInfo", join(fixtures, "unsupported-key-ca.pem"));
			await git(root, "config", "http.sslCAPath", selected);
		}
		await git(root, "config", "http.extraHeader", "X-Backlog-Fixture: preserved");
		let requests = 0;
		let header: string | string[] | undefined;
		const peer = await readFile(join(fixtures, fixture.chain));
		const leaf = new X509Certificate(peer);
		expect(Date.parse(leaf.validFrom)).toBeLessThan(Date.now());
		expect(Date.parse(leaf.validTo)).toBeGreaterThan(Date.now());
		const server = createServer(
			{ key: await readFile(join(fixtures, "registry-server-key.pem")), cert: peer },
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
			await git(root, "config", "remote.origin.url", `https://localhost:${address.port}/repository`);
			const operations = new GitOperations(root);
			const internals = operations as unknown as {
				execGit: (args: string[], options?: { env?: NodeJS.ProcessEnv; timeoutMs?: number }) => Promise<unknown>;
			};
			const execute = internals.execGit.bind(operations);
			const completed = (error: unknown, expectedRequests: number) => {
				const diagnostic = `${fixture.name}/${fixture.prefix ?? fixture.authority ?? "no-prefix"}/${fixture.file ? "file" : "directory"}/${fixture.chain}: ${String(error)}`;
				if (!(error instanceof Error) || /timeout|could not spawn/i.test(diagnostic)) throw new Error(diagnostic);
				expect(diagnostic).toMatch(expectedRequests ? /404|not found/i : /certificate|SSL|issuer|trust/i);
			};
			let baselineError: unknown;
			await execute(["fetch", "origin", "--quiet"], { timeoutMs: 10000 }).catch((error) => {
				baselineError = error;
			});
			const baselineRequests = requests;
			expect([0, 1]).toContain(baselineRequests);
			if (fixture.file && fixture.authority === "trusted-registry-ca.pem" && !fixture.secondAuthority) {
				trustedFileAccepted = baselineRequests === 1;
			}
			if (fixture.incident && trustedFileAccepted) expect(baselineRequests).toBe(1);
			if (fixture.name === "81ee7702.0" && !fixture.authority) expect(baselineRequests).toBe(1);
			if (fixture.authority === "rejected-registry-ca.pem" && !fixture.secondAuthority)
				expect(baselineRequests).toBe(0);
			completed(baselineError, baselineRequests);
			requests = 0;
			header = undefined;
			let fetchError: unknown;
			internals.execGit = async (args, options) => {
				if (args[0] === "fetch") {
					const file = await readFile(options?.env?.GIT_SSL_CAINFO as string, "utf8");
					if (fixture.file) {
						expect(trustedCertificates([file])).toEqual(trustedCertificates([authority]));
					} else {
						expect(trustedCertificates([file])).not.toContain(privateCA.trim());
					}
					if (fixture.prefix === "non-pem" || fixture.prefix === "empty" || fixture.prefix === "blocked-non-pem") {
						const prefix = fixture.prefix === "blocked-non-pem" ? "81ee7702.1" : "81ee7702.0";
						expect(await readFile(join(options?.env?.GIT_SSL_CAPATH as string, prefix), "utf8")).toBe("");
					}
				}
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
			const expected = fixture.chain.startsWith("incident-") ? 0 : baselineRequests;
			completed(fetchError, expected);
			expect(requests).toBe(expected);
			expect(header as string | string[] | undefined).toBe(expected ? "preserved" : undefined);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}
}, 60000);

test("Node-only extra CAs do not become default Git authorities in a fresh process", async () => {
	const root = await temporary();
	const globalConfig = join(root, "global-gitconfig");
	await writeFile(globalConfig, "");
	await git(root, "init", "--quiet");
	if (process.platform === "win32") {
		await git(root, "config", "http.sslBackend", "schannel");
		await git(root, "config", "http.schannelUseSSLCAInfo", "true");
		await git(root, "config", "http.schannelCheckRevoke", "false");
	}
	let requests = 0;
	const server = createServer(
		{
			key: await readFile(join(fixtures, "registry-server-key.pem")),
			cert: await readFile(join(fixtures, "registry-server.pem")),
		},
		(_request, response) => {
			requests++;
			response.writeHead(404);
			response.end("fixture repository not found");
		},
	);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("Expected loopback origin address");
		await git(
			root,
			"config",
			"remote.origin.url",
			`https://fixture-user:fixture-password@localhost:${address.port}/repository`,
		);
		// Windows checkouts can use CRLF; authority identity must be DER-based.
		const extraCA = join(root, "node-only-extra-ca.pem");
		await writeFile(extraCA, (await readFile(join(fixtures, "registry-ca.pem"), "utf8")).replace(/\r?\n/g, "\r\n"));
		const probe = join(root, "probe.ts");
		await writeFile(
			probe,
			`
			import {readFile} from 'node:fs/promises';
			import {getCACertificates} from 'node:tls';
			import {X509Certificate} from 'node:crypto';
			import {GitOperations} from ${JSON.stringify(resolve(import.meta.dir, "../git/operations.ts"))};
			const privateCA = await readFile(process.env.NODE_EXTRA_CA_CERTS, 'utf8');
			const fingerprint = pem => new X509Certificate(pem).fingerprint256;
			const privateFingerprint = fingerprint(privateCA);
			const extraFingerprints = getCACertificates('extra').map(fingerprint);
			const operations = new GitOperations(process.cwd());
			const execute = operations.execGit.bind(operations);
			let bundle;
			operations.execGit = async (args, options) => {
				if (args[0] === 'fetch' && options?.env?.GIT_SSL_CAINFO) bundle = await readFile(options.env.GIT_SSL_CAINFO, 'utf8');
				return execute(args, options);
			};
			let error;
			try {
				if (process.argv[2] === 'raw') await execute(['fetch', 'origin', '--quiet'], {timeoutMs:10000, env:{GIT_TERMINAL_PROMPT:'0', GCM_INTERACTIVE:'Never'}});
				else await operations.fetch();
			} catch (failure) { error = String(failure); }
			console.log(JSON.stringify({error, extraHasPrivate:extraFingerprints.includes(privateFingerprint), extraFingerprints, privateFingerprint,
				bundleHasPrivate:bundle?.match(/-----BEGIN CERTIFICATE-----[\\s\\S]+?-----END CERTIFICATE-----/g)?.some(pem => fingerprint(pem) === privateFingerprint), bundlePresent:!!bundle}));
		`,
		);
		const childEnvironment = Object.fromEntries(
			Object.entries(process.env).filter(
				([name]) =>
					!/^(?:git_config(?:_.+)?|git_ssl_(?:no_verify|cainfo|capath)|git_proxy_ssl_cainfo|https?_proxy|all_proxy|no_proxy|ssl_cert_(?:file|dir)|curl_ca_bundle|node_extra_ca_certs)$/i.test(
						name,
					),
			),
		);
		Object.assign(childEnvironment, {
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: globalConfig,
			NODE_EXTRA_CA_CERTS: extraCA,
		});
		for (const mode of ["raw", "guarded"]) {
			requests = 0;
			const child = Bun.spawn([process.execPath, probe, mode], {
				cwd: root,
				env: childEnvironment,
				stdout: "pipe",
				stderr: "pipe",
			});
			const [code, stdout, stderr] = await Promise.all([
				child.exited,
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
			]);
			if (code !== 0) throw new Error(`${mode} Git trust child failed: ${stderr}`);
			const result = JSON.parse(stdout);
			if (!result.extraHasPrivate)
				throw new Error(`Node-only CA fixture missing from extra pool: ${JSON.stringify(result)}`);
			expect(result.extraHasPrivate).toBe(true);
			if (
				typeof result.error !== "string" ||
				/timeout|could not spawn/i.test(result.error) ||
				!/certificate|SSL|issuer|trust|schannel/i.test(result.error)
			)
				throw new Error(`${mode} must complete native certificate rejection: ${result.error}`);
			if (requests !== 0)
				throw new Error(`${mode} Git unexpectedly sent ${requests} HTTP requests with a Node-only CA: ${result.error}`);
			if (mode === "guarded") {
				expect(result.bundlePresent).toBe(true);
				expect(result.bundleHasPrivate).toBe(false);
			}
		}
	} finally {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}, 20000);

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

test("native CA lookup preserves username matching without putting HTTPS userinfo in child arguments", async () => {
	for (const key of Object.keys(process.env)) {
		if (/^(git_config_(?:count|parameters|key_\d+|value_\d+)|git_ssl_ca(info|path))$/i.test(key))
			delete process.env[key];
	}
	const cases: Array<[string, string, boolean?]> = [
		["https://test-user@example.invalid/repository", "https://test%2Duser:fixture-secret@example.invalid/repository"],
		["https://test%2Duser@example.invalid/repository", "https://test-user:fixture-secret@example.invalid/repository"],
		[
			"https://test%40user@example.invalid/repository",
			"https://%74est%40user:fixture-secret@example.invalid/repository",
		],
		[
			"https://fixture-token@example.invalid/repository",
			"https://fixture-token:fixture-secret@example.invalid/repository",
		],
		[
			"https://token=abc@*.example.invalid/repository",
			"https://token=abc:fixture-secret@sub.example.invalid/repository/nested",
		],
		[
			"https://current-user@example.invalid/repository",
			"https://current-user:fixture-secret@example.invalid/repository",
			true,
		],
	];
	for (const [scope, remote, tilde] of cases) {
		const root = await temporary();
		await git(root, "init", "--quiet");
		await git(root, "config", "http.sslCAInfo", join(fixtures, "unsupported-key-ca.pem"));
		let privateCA = join(fixtures, "registry-ca.pem");
		let configuredCA = privateCA;
		if (tilde) {
			// Own and clean up this temporary fixture; never rewrite the user's config.
			const userDirectory = await mkdtemp(join(homedir(), "backlog-git-ca-fixture-"));
			roots.push(userDirectory);
			privateCA = join(userDirectory, "private.pem");
			await writeFile(privateCA, await readFile(join(fixtures, "registry-ca.pem")));
			configuredCA = `~/${basename(userDirectory)}/private.pem`;
		}
		await git(root, "config", `http.${scope}.sslCAInfo`, configuredCA);
		// Native Git ignores this unusable path when it does not match the remote.
		await git(
			root,
			"config",
			"http.https://unrelated.invalid/repository.sslCAInfo",
			"~backlog-nonexistent-user-908134/ca.pem",
		);
		await git(root, "config", `url.${remote}.insteadOf`, "fixture:repository");
		await git(root, "config", "remote.origin.url", "fixture:repository");
		const expected = await git(
			root,
			"config",
			"--null",
			"--path",
			"--get-urlmatch",
			"http.sslCAInfo",
			remote as string,
		);
		expect(expected.endsWith("\0")).toBe(true);
		expect(resolve(expected.slice(0, -1))).toBe(resolve(privateCA));
		const operations = new GitOperations(root);
		const internals = operations as unknown as {
			execGit: (args: string[], options?: { env?: NodeJS.ProcessEnv }) => Promise<{ stdout: string; stderr: string }>;
		};
		const execute = internals.execGit.bind(operations);
		const argumentsSeen: string[][] = [];
		let fetched = false;
		internals.execGit = async (args, options) => {
			argumentsSeen.push(args);
			if (args[0] !== "fetch") return execute(args, options);
			fetched = true;
			expect(trustedCertificates([await readFile(options?.env?.GIT_SSL_CAINFO as string, "utf8")])).toEqual([
				(await readFile(join(fixtures, "registry-ca.pem"), "utf8")).trim(),
			]);
			return { stdout: "", stderr: "" };
		};
		await operations.fetch();
		expect(fetched).toBe(true);
		const serialized = JSON.stringify(argumentsSeen);
		expect(serialized).not.toContain("fixture-secret");
		expect(serialized).not.toContain(new URL(remote as string).username);
	}
	const root = await temporary();
	await git(root, "init", "--quiet");
	await git(root, "config", "remote.origin.url", "https://fixture-token:fixture-secret@example.invalid/repository");
	await git(root, "config", "http.not-a-url.sslCAInfo", join(fixtures, "registry-ca.pem"));
	await expect(new GitOperations(root).fetch()).rejects.toThrow("Invalid URL in Git HTTPS CA configuration");
	await git(root, "config", "--unset", "http.not-a-url.sslCAInfo");
	await git(
		root,
		"config",
		"http.https://fixture-token@example.invalid/repository.sslCAInfo",
		"~backlog-nonexistent-user-908134/ca.pem",
	);
	await expect(new GitOperations(root).fetch()).rejects.toThrow("failed to expand user dir");
});

const nativeFetchCases = ["", "http::", "https::", "ftp::", "ftps::"].flatMap((helper) =>
	(process.platform === "win32" ? ["canonical", "lowercase"] : ["canonical"]).map((style) => ({ helper, style })),
);
test.each(nativeFetchCases)(
	"native Git HTTPS fetch preserves private trust and auth but rejects both incident paths ($style, helper=$helper)",
	async ({ style, helper }) => {
		const root = await temporary();
		const incidents = (await Bun.file(join(fixtures, "compromised-cas.json")).json()).certificates;
		const selected = join(root, "selected-ca.pem");
		const selectedDirectory = join(root, "selected-ca-directory");
		await mkdir(selectedDirectory);
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
			if (
				/^(git_config_(?:count|parameters|key_\d+|value_\d+)|git_ssl_cainfo|git_ssl_capath|git_proxy_ssl_cainfo|https?_proxy|all_proxy)$/i.test(
					key,
				)
			)
				delete process.env[key];
		}
		const variant = (name: string) =>
			style === "lowercase" &&
			/^GIT_(?:SSL_CA(?:INFO|PATH)|SSL_NO_VERIFY|PROXY_SSL_CAINFO|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/.test(
				name,
			)
				? name.toLowerCase()
				: name;
		const inherited: Record<string, string> = {
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: join(root, "global-gitconfig"),
			GIT_CONFIG_COUNT: "1",
			GIT_CONFIG_KEY_0: "http.extraHeader",
			GIT_CONFIG_VALUE_0: "X-Backlog-Fixture: preserved",
			GIT_CONFIG_PARAMETERS: "'http.extraHeader=X-Backlog-Command: preserved'",
			GIT_SSL_NO_VERIFY: "false",
			// An unused invalid proxy CA must not abort direct HTTPS.
			GIT_PROXY_SSL_CAINFO: join(root, "missing-proxy-ca.pem"),
			NO_PROXY: "localhost,127.0.0.1",
			no_proxy: "localhost,127.0.0.1",
		};
		if (style === "lowercase") {
			inherited.GIT_SSL_CAINFO = selected;
			inherited.GIT_SSL_CAPATH = selectedDirectory;
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
			let commandHeader: string | string[] | undefined;
			const peer = await readFile(join(fixtures, chain));
			const leaf = new X509Certificate(peer);
			expect(Date.parse(leaf.validFrom)).toBeLessThan(Date.now());
			expect(Date.parse(leaf.validTo)).toBeGreaterThan(Date.now());
			const server = createServer(
				{ key: await readFile(join(fixtures, "registry-server-key.pem")), cert: peer },
				(request, response) => {
					requests++;
					header = request.headers["x-backlog-fixture"];
					commandHeader = request.headers["x-backlog-command"];
					response.writeHead(404);
					response.end("fixture repository not found");
				},
			);
			await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
			try {
				const address = server.address();
				if (!address || typeof address === "string") throw new Error("Expected loopback server address");
				const url = `https://test=user:test-secret@localhost:${address.port}/repository`;
				const configuredURL = `https://test=user@localhost:${address.port}/repository`;
				await git(root, "config", "remote.origin.url", `${helper}${url}`);
				await git(
					root,
					"config",
					`http.${configuredURL}.sslCAInfo`,
					style === "lowercase" ? join(fixtures, "unsupported-key-ca.pem") : selected,
				);
				await git(root, "config", `http.${configuredURL}.sslVerify`, "false");
				const parameters = `${inherited.GIT_CONFIG_PARAMETERS} 'http.${configuredURL}.sslVerify'='false' 'http.${configuredURL}.schannelUseSSLCAInfo'='false'`;
				process.env[variant("GIT_CONFIG_PARAMETERS")] = parameters;
				const operations = new GitOperations(root);
				const internals = operations as unknown as {
					execGit: (args: string[], options?: unknown) => Promise<{ stdout: string; stderr: string }>;
				};
				const execute = internals.execGit.bind(operations);
				// An unfiltered native verifier must accept this currently valid chain.
				// This control fails after expiry instead of silently accepting any TLS error.
				let baselineError: unknown;
				await execute(["fetch", "origin", "--quiet"], {
					timeoutMs: 10000,
					env: {
						GIT_SSL_CAINFO: selected,
						GIT_SSL_CAPATH: selectedDirectory,
						GIT_CONFIG_PARAMETERS: `${parameters} 'http.${configuredURL}.sslVerify'='true' 'http.${configuredURL}.schannelUseSSLCAInfo'='true'`,
						[variant("GIT_SSL_NO_VERIFY")]: undefined,
						GIT_TERMINAL_PROMPT: "0",
						GCM_INTERACTIVE: "Never",
					},
				}).catch((error) => {
					baselineError = error;
				});
				if (requests !== 1 || !/404|not found/i.test(String(baselineError))) {
					throw new Error(
						`Unfiltered Git must reach the fixture 404 for ${chain}: requests=${requests}, ${String(baselineError)}`,
					);
				}
				requests = 0;
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
					expect(commandHeader).toBe("preserved");
				}
				expect(process.env[variant("GIT_CONFIG_COUNT")]).toBe("1");
				expect(process.env[variant("GIT_CONFIG_PARAMETERS")]).toBe(parameters);
				expect(process.env[variant("GIT_SSL_NO_VERIFY")]).toBe("false");
			} finally {
				server.closeAllConnections();
				await new Promise<void>((resolve) => server.close(() => resolve()));
			}
		}
	},
	20000,
);

// Use native Git for both the unsafe baseline and guarded fetch: zero requests
// must mean completed TLS/file rejection, never a timeout or failed spawn.
async function proxyFixtureRoot(backend = "schannel") {
	const root = await temporary();
	for (const key of Object.keys(process.env)) {
		if (
			/^(git_(?:config_(?:count|parameters|key_\d+|value_\d+)|ssl_(?:no_verify|cainfo|capath)|proxy_ssl_cainfo)|https?_proxy|all_proxy|no_proxy)$/i.test(
				key,
			)
		)
			delete process.env[key];
	}
	process.env.GIT_CONFIG_NOSYSTEM = "1";
	process.env.GIT_CONFIG_GLOBAL = join(root, "global-gitconfig");
	await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
	await git(root, "init", "--quiet");
	await git(root, "config", "http.proxyAuthMethod", "basic");
	await git(root, "config", "http.schannelUseSSLCAInfo", "true");
	if (process.platform === "win32") {
		await git(root, "config", "http.sslBackend", backend);
		await git(root, "config", "http.schannelCheckRevoke", "false");
	}
	process.env.GIT_SSL_CAINFO = join(fixtures, "registry-ca.pem");
	const emptyDirectory = join(root, "empty");
	await mkdir(emptyDirectory);
	process.env.GIT_SSL_CAPATH = emptyDirectory;
	return root;
}

const proxyCases = ["registry-server.pem", "incident-server-emudhra.pem", "incident-server-aaa.pem"].flatMap((chain) =>
	["http", "https"].flatMap((protocol) =>
		(process.platform === "win32" ? ["canonical", "lowercase"] : ["canonical"]).flatMap((style) =>
			(process.platform === "win32" ? ["openssl", "schannel"] : ["default"]).flatMap((backend) =>
				(chain === "registry-server.pem" && protocol === "http" ? ["", "https::"] : [""]).map((helper) => ({
					chain,
					protocol,
					style,
					backend,
					helper,
				})),
			),
		),
	),
);
test.each(proxyCases)(
	"HTTPS proxy restriction blocks HTTP and auth before transmission ($chain, $protocol, $style, $backend, helper=$helper)",
	async ({ chain, protocol, style, backend, helper }) => {
		const root = await proxyFixtureRoot(backend);
		const incidents = (await Bun.file(join(fixtures, "compromised-cas.json")).json()).certificates;
		const selected = join(root, "selected-proxy-ca.pem");
		await writeFile(
			selected,
			[
				await readFile(join(fixtures, "registry-ca.pem"), "utf8"),
				...incidents.map((certificate: { pem: string }) => certificate.pem),
			].join("\n"),
		);
		process.env[style === "lowercase" ? "git_proxy_ssl_cainfo" : "GIT_PROXY_SSL_CAINFO"] = selected;
		const cert = await readFile(join(fixtures, chain));
		const leaf = new X509Certificate(cert);
		expect(Date.parse(leaf.validFrom)).toBeLessThan(Date.now());
		expect(Date.parse(leaf.validTo)).toBeGreaterThan(Date.now());
		let requests = 0;
		let authorization: string | undefined;
		const sockets = new Set<Socket>();
		const server = createTLSServer(
			{ key: await readFile(join(fixtures, "registry-server-key.pem")), cert },
			(socket) => {
				socket.once("data", (data) => {
					requests++;
					authorization = /proxy-authorization: ([^\r\n]+)/i.exec(data.toString())?.[1];
					socket.end("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n");
				});
			},
		);
		server.on("connection", (socket) => {
			sockets.add(socket);
			socket.on("close", () => sockets.delete(socket));
		});
		server.on("tlsClientError", () => {});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		try {
			const address = server.address();
			if (!address || typeof address === "string") throw new Error("Expected loopback proxy address");
			await git(root, "config", "http.proxy", `https://fixture-user:fixture-password@localhost:${address.port}`);
			await git(root, "config", "remote.origin.url", `${helper}${protocol}://fixture-origin.invalid/repository`);
			const operations = new GitOperations(root);
			const internals = operations as unknown as {
				execGit: (
					args: string[],
					options?: { env?: NodeJS.ProcessEnv; timeoutMs?: number },
				) => Promise<{ stdout: string; stderr: string }>;
			};
			const execute = internals.execGit.bind(operations);
			// Windows' native Schannel proxy revocation can reject the incident roots
			// independently. Keep raw acceptance controls on the same Git's OpenSSL
			// backend; Schannel must instead fail on our exact owned impossible path.
			if (backend !== "schannel") {
				let baselineError: unknown;
				await execute(["fetch", "origin", "--quiet"], {
					timeoutMs: 10000,
					env: { GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
				}).catch((error) => {
					baselineError = error;
				});
				if (requests !== 1 || !/502/.test(String(baselineError)))
					throw new Error(
						`Unfiltered ${protocol} HTTPS proxy ${chain} must reach fixture: requests=${requests}, ${String(baselineError)}`,
					);
				expect(authorization).toBe(`Basic ${Buffer.from("fixture-user:fixture-password").toString("base64")}`);
			}
			requests = 0;
			authorization = undefined;
			// Schannel clears proxy CAinfo too unless the exact origin policy opts in.
			await git(root, "config", `http.${protocol}://fixture-origin.invalid/repository.schannelUseSSLCAInfo`, "false");
			let nativeError: unknown;
			let fetchError: unknown;
			internals.execGit = async (args, options) => {
				try {
					return await execute(args, options);
				} catch (error) {
					if (args[0] === "fetch") nativeError = error;
					throw error;
				}
			};
			await operations.fetch().catch((error) => {
				fetchError = error;
			});
			const diagnostic = `${protocol} proxy ${chain} (${style}, ${backend}): ${String(nativeError)}`;
			if (
				!(nativeError instanceof Error) ||
				/timeout|could not spawn/i.test(diagnostic) ||
				!/certificate|CAfile|schannel|SSL/i.test(diagnostic)
			)
				throw new Error(`Expected completed proxy TLS/file rejection: ${diagnostic}`);
			if (backend === "schannel") {
				// Schannel can reject an incident root through ambient OS revocation;
				// require our loader failure. GnuTLS reports a generic CA-loader error.
				expect(String(nativeError).replaceAll("\\", "/")).toContain("/unsupported-https-proxy/unavailable.pem");
			}
			if (requests !== 0 || authorization !== undefined)
				throw new Error(`HTTPS proxy received HTTP/auth: requests=${requests}, ${diagnostic}`);
			expect(fetchError).toBeInstanceOf(Error);
			expect(String(fetchError)).toMatch(
				backend === "schannel"
					? /HTTPS proxies are unsupported/
					: /HTTPS proxies are unsupported|certificate|CAfile|SSL/i,
			);
		} finally {
			for (const socket of sockets) socket.destroy();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	},
	20000,
);

test("HTTP CONNECT proxies retain private origin trust and proxy authentication", async () => {
	const root = await proxyFixtureRoot();
	// The configured bad HTTPS-proxy CA is unused for an ordinary HTTP proxy.
	process.env.GIT_PROXY_SSL_CAINFO = join(root, "missing-proxy-ca.pem");
	let originRequests = 0;
	let connects = 0;
	let authorization: string | undefined;
	const origin = createServer(
		{
			key: await readFile(join(fixtures, "registry-server-key.pem")),
			cert: await readFile(join(fixtures, "registry-server.pem")),
		},
		(_request, response) => {
			originRequests++;
			response.writeHead(404);
			response.end("fixture repository not found");
		},
	);
	const sockets = new Set<Socket>();
	await new Promise<void>((resolve) => origin.listen(0, "127.0.0.1", resolve));
	const originAddress = origin.address();
	if (!originAddress || typeof originAddress === "string") throw new Error("Expected loopback origin address");
	const proxy = createTCPServer((socket) => {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
		let header = Buffer.alloc(0);
		const receive = (data: Buffer) => {
			header = Buffer.concat([header, data]);
			const end = header.indexOf("\r\n\r\n");
			if (end < 0) return;
			socket.removeListener("data", receive);
			connects++;
			authorization = /proxy-authorization: ([^\r\n]+)/i.exec(header.toString())?.[1];
			const upstream = connect(originAddress.port, "127.0.0.1", () => {
				socket.write("HTTP/1.1 200 Connection established\r\n\r\n");
				if (header.length > end + 4) upstream.write(header.subarray(end + 4));
				socket.pipe(upstream);
				upstream.pipe(socket);
			});
			sockets.add(upstream);
			upstream.on("close", () => sockets.delete(upstream));
			upstream.on("error", () => socket.destroy());
			socket.on("error", () => upstream.destroy());
		};
		socket.on("data", receive);
	});
	await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
	try {
		const address = proxy.address();
		if (!address || typeof address === "string") throw new Error("Expected loopback proxy address");
		await git(root, "config", "http.proxy", `http://fixture-user:fixture-password@localhost:${address.port}`);
		await git(root, "config", "remote.origin.url", `https://localhost:${originAddress.port}/repository`);
		let failure: unknown;
		await new GitOperations(root).fetch().catch((error) => {
			failure = error;
		});
		if (connects !== 1 || originRequests !== 1 || !/404|not found/i.test(String(failure)))
			throw new Error(
				`HTTP proxy must reach private origin404: connects=${connects}, requests=${originRequests}, ${String(failure)}`,
			);
		expect(authorization).toBe(`Basic ${Buffer.from("fixture-user:fixture-password").toString("base64")}`);
	} finally {
		for (const socket of sockets) socket.destroy();
		origin.closeAllConnections();
		await Promise.all([
			new Promise<void>((resolve) => proxy.close(() => resolve())),
			new Promise<void>((resolve) => origin.close(() => resolve())),
		]);
	}
}, 20000);
