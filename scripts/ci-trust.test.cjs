const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { it } = require("node:test");
// Reuse the YAML engine already installed and pinned for frontmatter.
const yaml = createRequire(require.resolve("gray-matter"))("js-yaml");

for (const workflow of ["ci.yml", "release.yml", "architecture.yml"]) {
	it(`${workflow} prepares strict Git trust before network steps and preserves inherited authentication`, () => {
		const document = yaml.load(readFileSync(path.join(__dirname, "../.github/workflows", workflow), "utf8"));
		assert.equal(document.env.NODE_OPTIONS, "--use-openssl-ca");
		const jobs = Object.values(document.jobs);
		const bootstrap = jobs[0].steps[0].run;
		for (const job of jobs) assert.equal(job.steps[0].run, bootstrap, "every job must bootstrap before network steps");
		const match = /^node <<'NODE'\n([\s\S]+)\nNODE\n?$/.exec(bootstrap);
		assert.ok(match, "execute the actual inline Node program");
		const directory = mkdtempSync(path.join(os.tmpdir(), "backlog-workflow-trust-test-"));
		try {
			const repository = "https://github.com/MrLesk/Backlog.md";
			const inherited = Object.fromEntries(
				Object.entries(process.env).filter(
					([key]) => !/^git_(?:config_(?:count|parameters|key_\d+|value_\d+)|ssl_no_verify)$/i.test(key),
				),
			);
			const env = {
				...inherited,
				...document.env,
				RUNNER_TEMP: directory,
				GITHUB_ENV: path.join(directory, "environment"),
				GITHUB_SERVER_URL: "https://github.com",
				GITHUB_REPOSITORY: "MrLesk/Backlog.md",
				GIT_CONFIG_COUNT: "1",
				GIT_CONFIG_KEY_0: "http.extraHeader",
				GIT_CONFIG_VALUE_0: "X-Fixture-Indexed: preserved",
				GIT_CONFIG_PARAMETERS: `'http.extraHeader'='X-Fixture-Parameters: preserved' 'http.${repository}.sslVerify'='false' 'http.${repository}.git.schannelUseSSLCAInfo'='false'`,
				GIT_CONFIG_GLOBAL: path.join(directory, "global-gitconfig"),
				GIT_CONFIG_NOSYSTEM: "1",
				NODE_TLS_REJECT_UNAUTHORIZED: "0",
			};
			writeFileSync(env.GIT_CONFIG_GLOBAL, "");
			const run = (environment) =>
				spawnSync(process.execPath, ["-e", match[1]], { env: environment, encoding: "utf8", timeout: 5000 });
			const result = run(env);
			assert.equal(result.status, 0, result.stderr || String(result.error));
			const settings = Object.fromEntries(
				readFileSync(env.GITHUB_ENV, "utf8")
					.trimEnd()
					.split("\n")
					.map((line) => {
						const separator = line.indexOf("=");
						return [line.slice(0, separator), line.slice(separator + 1)];
					}),
			);
			assert.ok(settings.GIT_CONFIG_PARAMETERS.startsWith(`${env.GIT_CONFIG_PARAMETERS} `));
			assert.equal(settings.NODE_TLS_REJECT_UNAUTHORIZED, "1");
			assert.equal(readFileSync(path.dirname(settings.GIT_PROXY_SSL_CAINFO), "utf8"), "");
			assert.throws(() => readFileSync(settings.GIT_PROXY_SSL_CAINFO), /ENOTDIR|ENOENT/);
			assert.ok(settings.GIT_PROXY_SSL_CAINFO.startsWith(`${directory}${path.sep}backlog-proxy-trust-`));
			assert.notEqual(path.dirname(settings.GIT_PROXY_SSL_CAINFO), settings.GIT_SSL_CAPATH);
			// Keep the server and client in one child so synchronous execution cannot
			// block the fixture's TLS handshake. No operating-system store is changed.
			const peer = path.join(__dirname, "../src/test/fixtures/certificate-trust");
			const probe = `
				const https = require('node:https'), fs = require('node:fs'), path = require('node:path');
				let requests = 0;
				const server = https.createServer({key: fs.readFileSync(path.join(process.argv[1], 'registry-server-key.pem')),
					cert: fs.readFileSync(path.join(process.argv[1], 'registry-server.pem'))}, (_request, response) => {
					requests++; response.end('fixture');
				});
				function done(code) { server.closeAllConnections(); server.close(() => console.log(JSON.stringify({requests, code}))); }
				server.listen(0, '127.0.0.1', () => {
					const request = https.get({hostname: 'localhost', family: 4, port: server.address().port, ca: [], agent: false}, response => {
						response.resume(); response.on('end', () => done('HTTP'));
					});
					request.on('error', error => done(error.code));
				});`;
			const httpsControl = (environment) => {
				const child = spawnSync(process.execPath, ["-e", probe, peer], {
					env: environment,
					encoding: "utf8",
					timeout: 5000,
				});
				assert.equal(child.status, 0, child.stderr || String(child.error));
				return JSON.parse(child.stdout);
			};
			assert.deepEqual(httpsControl(env), { requests: 1, code: "HTTP" });
			const strict = httpsControl({ ...env, ...settings });
			assert.equal(strict.requests, 0);
			assert.match(strict.code, /CERT|ISSUER|SIGNATURE/);

			for (const url of [repository, `${repository}.git`]) {
				for (const key of ["http.sslVerify", "http.schannelUseSSLCAInfo"]) {
					const lookup = spawnSync("git", ["config", "--get-urlmatch", key, url], {
						env: { ...env, ...settings },
						encoding: "utf8",
					});
					assert.equal(lookup.status, 0, lookup.stderr);
					assert.equal(lookup.stdout.trim(), "true");
				}
			}
			const authentication = spawnSync("git", ["config", "--get-all", "http.extraHeader"], {
				env: { ...env, ...settings },
				encoding: "utf8",
			});
			assert.equal(authentication.status, 0, authentication.stderr);
			assert.deepEqual(authentication.stdout.trim().split("\n"), [
				"X-Fixture-Indexed: preserved",
				"X-Fixture-Parameters: preserved",
			]);
			for (const [key, value] of [
				["GIT_SSL_NO_VERIFY", "false"],
				["GIT_SSL_NO_VERIFY", ""],
				["gIt_SsL_nO_vErIfY", "true"],
			]) {
				const rejected = run({ ...env, [key]: value });
				assert.notEqual(rejected.status, 0);
				assert.match(rejected.stderr, /Remove GIT_SSL_NO_VERIFY/);
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
}
