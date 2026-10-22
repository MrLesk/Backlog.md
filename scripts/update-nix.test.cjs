const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { mkdtemp, mkdir, readFile, writeFile, rm } = require("node:fs/promises");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { it } = require("node:test");
const { promisify } = require("node:util");
const execute = promisify(execFile);
const script = path.join(__dirname, "update-nix.cjs");
const fixture = path.join(__dirname, "../src/test/fixtures/certificate-trust");

async function temporary(t) {
	const root = await mkdtemp(path.join(os.tmpdir(), "backlog-update-nix-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
}
async function run(root, env = {}, args = [script]) {
	return execute(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, timeout: 15000 }).then(
		(value) => ({ ...value, code: 0 }),
		(error) => error,
	);
}
async function localGenerator(root, version) {
	await writeFile(
		path.join(root, "bun2nix"),
		`#!${process.execPath}\nconst fs=require('node:fs'); if(process.argv.includes('--version')) console.log(${JSON.stringify(version)}); else fs.writeFileSync('generated.json',JSON.stringify({args:process.argv.slice(2),bypass:process.env.GIT_SSL_NO_VERIFY}));`,
		{ mode: 0o755 },
	);
}

it("rejects unpatched Node and absent, unreadable, empty or malformed CA before invoking a generator", async (t) => {
	const root = await temporary(t);
	await localGenerator(root, "bun2nix, 2.1.2");
	const env = { PATH: root, SSL_CERT_FILE: path.join(fixture, "registry-ca.pem") };
	const old = await run(root, env, [
		"-e",
		`Object.defineProperty(process.versions,'node',{value:'26.12.0'});require(${JSON.stringify(script)})`,
	]);
	assert.notEqual(old.code, 0);
	assert.match(old.stderr, /patched Node/);
	for (const [name, content] of [
		["empty", ""],
		["invalid", "-----BEGIN CERTIFICATE-----\nbroken\n-----END CERTIFICATE-----"],
	])
		await writeFile(path.join(root, name), content);
	for (const file of ["", path.join(root, "missing"), path.join(root, "empty"), path.join(root, "invalid")]) {
		assert.notEqual((await run(root, { ...env, SSL_CERT_FILE: file })).code, 0);
	}
	await assert.rejects(readFile(path.join(root, "generated.json")), { code: "ENOENT" });
});

it("uses only the exact local generator version and omits the inherited Git TLS bypass", async (t) => {
	const root = await temporary(t);
	const env = { PATH: root, SSL_CERT_FILE: path.join(fixture, "registry-ca.pem"), GIT_SSL_NO_VERIFY: "false" };
	await localGenerator(root, "bun2nix, 2.1.1");
	assert.notEqual((await run(root, env)).code, 0);
	await assert.rejects(readFile(path.join(root, "generated.json")), { code: "ENOENT" });
	await localGenerator(root, "bun2nix, 2.1.2");
	assert.equal((await run(root, env)).code, 0);
	for (const file of ["trusted-registry-ca.pem", "rejected-registry-ca.pem"]) {
		const result = await run(root, { ...env, SSL_CERT_FILE: path.join(fixture, file) });
		assert.equal(result.code, 0, result.stderr);
	}
	assert.deepEqual(JSON.parse(await readFile(path.join(root, "generated.json"), "utf8")), { args: ["-o", "bun.nix"] });
});

it("runs pinned npm resolution on the same Node with strict TLS while retaining native config", async (t) => {
	const root = await temporary(t);
	const globalRoot = path.join(root, "modules");
	await mkdir(path.join(globalRoot, "npm/bin"), { recursive: true });
	await writeFile(path.join(root, "npm"), `#!${process.execPath}\nconsole.log(${JSON.stringify(globalRoot)});`, {
		mode: 0o755,
	});
	await writeFile(
		path.join(globalRoot, "npm/bin/npm-cli.js"),
		`const fs=require('node:fs');if(process.argv.includes('--version'))console.log('12.2.0');else fs.writeFileSync('npm.json',JSON.stringify({node:process.execPath,args:process.argv.slice(2),auth:process.env.FIXTURE_AUTH,proxy:process.env.HTTPS_PROXY,bypass:process.env.GIT_SSL_NO_VERIFY,tls:process.env.NODE_TLS_REJECT_UNAUTHORIZED}));`,
	);
	const cafile = path.join(fixture, "registry-ca.pem");
	const result = await run(root, {
		PATH: root,
		SSL_CERT_FILE: cafile,
		FIXTURE_AUTH: "test-only-auth",
		HTTPS_PROXY: "http://test-only-proxy",
		GIT_SSL_NO_VERIFY: "false",
		NODE_TLS_REJECT_UNAUTHORIZED: "0",
	});
	assert.equal(result.code, 0, result.stderr);
	assert.deepEqual(JSON.parse(await readFile(path.join(root, "npm.json"), "utf8")), {
		node: process.execPath,
		args: [
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
		auth: "test-only-auth",
		proxy: "http://test-only-proxy",
		tls: "1",
	});
});

it("native npm reaches a private registry but sends no HTTP request through either incident chain", async (t) => {
	const root = await temporary(t);
	const incidents = JSON.parse(await readFile(path.join(fixture, "compromised-cas.json"), "utf8")).certificates;
	const extra = path.join(root, "inherited-incident.pem");
	await writeFile(extra, incidents.map((certificate) => certificate.pem).join("\n"));
	for (const chain of ["registry-server.pem", "incident-server-emudhra.pem", "incident-server-aaa.pem"]) {
		let requests = 0;
		const peer = await readFile(path.join(fixture, chain));
		const leaf = new X509Certificate(peer);
		assert.ok(Date.parse(leaf.validFrom) < Date.now(), `${chain}: fixture is not yet valid`);
		assert.ok(
			Date.parse(leaf.validTo) > Date.now(),
			`${chain}: renew the expired incident fixture before trusting this rejection`,
		);
		const server = https.createServer(
			{
				key: await readFile(path.join(fixture, "registry-server-key.pem")),
				cert: peer,
			},
			(_request, response) => {
				requests++;
				response.writeHead(404, { "content-type": "application/json" });
				response.end('{"error":"fixture package not found"}');
			},
		);
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		try {
			const env = {
				SSL_CERT_FILE: path.join(fixture, "registry-ca.pem"),
				NODE_EXTRA_CA_CERTS: extra,
				npm_config_registry: `https://localhost:${server.address().port}`,
				npm_config_cache: path.join(root, chain),
				npm_config_fetch_retries: "0",
				npm_config_fetch_timeout: "5000",
				npm_config_strict_ssl: "false",
				NO_PROXY: "localhost,127.0.0.1",
				no_proxy: "localhost,127.0.0.1",
			};
			const result = await run(root, env);
			assert.notEqual(result.code, 0);
			if (chain === "registry-server.pem") assert.ok(requests > 0, result.stderr);
			else {
				assert.equal(requests, 0, `${chain}: ${result.stderr}`);
				assert.match(result.stderr, /CERT_|certificate|issuer/i);
			}
			if (chain === "registry-server.pem") assert.match(result.stderr, /E404/);
		} finally {
			server.closeAllConnections();
			await new Promise((resolve) => server.close(resolve));
		}
	}
});
