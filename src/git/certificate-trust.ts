import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getCACertificates } from "node:tls";
import { trustedCertificates } from "../../scripts/filter-trusted-cas.cjs";

/** Windows environment names are case-insensitive even when Bun's JS lookup is not. */
export function gitTrustValue(
	name: "GIT_SSL_CAINFO" | "GIT_SSL_CAPATH" | "GIT_CONFIG_COUNT" | "GIT_CONFIG_PARAMETERS",
): string | undefined {
	if (process.platform !== "win32") return process.env[name];
	return Object.entries(process.env).find(([key]) => key.toUpperCase() === name)?.[1];
}

/** Remove HTTPS passwords without changing Git-significant username escaping. */
export function gitURLScope(value: string): string {
	try {
		if (
			/%(?![0-9a-f]{2})/i.test(value) ||
			[...value].some((character) => character.charCodeAt(0) <= 0x20 || character.charCodeAt(0) === 0x7f)
		)
			throw new Error();
		new URL(value);
		return value.replace(/^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)/i, (_, prefix: string, authority: string) => {
			const at = authority.lastIndexOf("@");
			if (at < 0) return prefix + authority;
			return `${prefix}${authority.slice(0, at).split(":", 1)[0]}@${authority.slice(at + 1)}`;
		});
	} catch {
		throw new Error("Invalid URL in Git HTTPS CA configuration");
	}
}

/** Isolate one Git HTTP fetch; HTTPS proxies are blocked until Git can isolate their CA path. */
export async function withGitFetchTrust(
	url: string,
	projectRoot: string,
	caFile: string | undefined,
	caDirectory: string | undefined,
	fetch: (environment: NodeJS.ProcessEnv) => Promise<void>,
): Promise<void> {
	const directory = await mkdtemp(join(tmpdir(), "backlog-git-trust-"));
	const proxyMarker = join(directory, "unsupported-https-proxy");
	const proxyCAFile = join(proxyMarker, "unavailable.pem");
	try {
		// Git exposes proxy CAfile but no proxy CApath: a filtered file alone still
		// admits affected host roots. A path beneath an owned regular file cannot
		// load: empty CA files can silently fall back to the proxy CA directory.
		// Direct connections and HTTP proxies ignore this HTTPS-proxy-only option.
		await writeFile(proxyMarker, "", { mode: 0o600 });
		const bypass = Object.fromEntries(
			Object.keys(process.env)
				.filter((key) => key.toUpperCase() === "GIT_SSL_NO_VERIFY")
				.map((key) => [key, undefined]),
		);
		const proxyTrust = { ...bypass, GIT_PROXY_SSL_CAINFO: proxyCAFile };
		const originTrust: NodeJS.ProcessEnv = {};
		if (/^https:\/\//i.test(url)) {
			if (caFile === "") throw new Error("Configured Git CA file is empty");
			const bundles: string[] = [];
			if (!caFile) {
				// Git's default trust must not gain Node-only bundled or extra roots.
				// A CA directory supplements the default CA file; it does not replace it.
				// Custom Git installations should select their CAfile/path explicitly.
				try {
					bundles.push(...getCACertificates("system"));
				} catch {
					throw new Error("Cannot read system CAs for Git. Configure GIT_SSL_CAINFO with the required CA bundle.");
				}
				if (!bundles.length) {
					throw new Error("No system CAs available for Git. Configure GIT_SSL_CAINFO with the required CA bundle.");
				}
			}
			if (caFile) bundles.push(await readFile(resolve(projectRoot, caFile), "utf8"));
			const certificates = trustedCertificates(bundles);
			const cafile = join(directory, "ca.pem");
			const capath = join(directory, "certificates");
			await mkdir(capath);
			if (caDirectory) {
				const original = resolve(projectRoot, caDirectory);
				const files = new Map<string, string>();
				const hashes = new Map<string, Set<number>>();
				for (const name of await readdir(original)) {
					const source = join(original, name);
					if (!(await stat(source)).isFile()) continue;
					const hashed = /^([a-f0-9]{8})\.(0|[1-9][0-9]*)$/i.exec(name);
					if (hashed) {
						const hash = hashed[1] as string;
						if (!hashes.has(hash)) hashes.set(hash, new Set());
						hashes.get(hash)?.add(Number(hashed[2]));
					}
					const contents = await readFile(source, "utf8");
					const pems = contents.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
					const unmatched = contents.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, "");
					if (/-----BEGIN (?:TRUSTED |X509 )?CERTIFICATE-----/.test(unmatched)) {
						throw new Error("Configured Git CA directory contains a malformed or unsupported PEM certificate");
					}
					const retained = pems.flatMap((pem) => trustedCertificates([pem], { allowEmpty: true }));
					const crls = contents.match(/-----BEGIN X509 CRL-----[\s\S]+?-----END X509 CRL-----/g) ?? [];
					// Some OpenSSL builds continue past an existing empty/non-PEM slot,
					// but stop at a missing one. Preserve that boundary without copying
					// unknown formats or filtered authorities into native trust.
					if (hashed && !retained.length && !crls.length) {
						await writeFile(join(capath, name), "", { mode: 0o600 });
					}
					if (pems.length || crls.length) files.set(name, [...retained, ...crls].join("\n"));
				}
				for (const [hash, indices] of hashes) {
					let input = 0;
					let output = 0;
					// Compact only gaps created by filtering, stopping at every original gap.
					while (indices.has(input) && files.has(`${hash}.${input}`)) {
						const name = `${hash}.${input++}`;
						const contents = files.get(name) as string;
						files.delete(name);
						if (contents) files.set(`${hash}.${output++}`, contents);
					}
				}
				// GnuTLS also reads ordinary files and entries beyond a hash gap. Keep
				// their names; promoting them into CAfile would broaden OpenSSL trust.
				for (const [name, contents] of files) {
					await writeFile(join(capath, name), contents, { mode: 0o600 });
				}
			}
			await writeFile(cafile, `${certificates.join("\n")}\n`, { mode: 0o600 });
			Object.assign(originTrust, {
				GIT_SSL_CAINFO: cafile,
				GIT_SSL_CAPATH: capath,
				SSL_CERT_FILE: cafile,
				SSL_CERT_DIR: capath,
				CURL_CA_BUNDLE: cafile,
			});
		}
		const scope = gitURLScope(url);
		const rawCount = gitTrustValue("GIT_CONFIG_COUNT") ?? "0";
		const count = Number(rawCount);
		if (!/^(0|[1-9][0-9]*)$/.test(rawCount) || !Number.isSafeInteger(count + 2)) {
			throw new Error("Invalid GIT_CONFIG_COUNT");
		}
		const strict = [
			[`http.${scope}.sslVerify`, "true"],
			[`http.${scope}.schannelUseSSLCAInfo`, "true"],
		];
		// Git parses PARAMETERS after indexed configuration. Preserve the opaque
		// inherited prefix and append our policy using Git's shell-quoted form.
		const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
		const parameters = strict.map(([key, value]) => `${quote(key as string)}=${quote(value as string)}`).join(" ");
		// Username-specific configuration outranks username-less keys. Keep that
		// specificity in the child environment without adding credentials to argv.
		await fetch({
			...proxyTrust,
			...originTrust,
			GIT_CONFIG_COUNT: String(count + 2),
			GIT_CONFIG_PARAMETERS: [gitTrustValue("GIT_CONFIG_PARAMETERS"), parameters].filter(Boolean).join(" "),
			[`GIT_CONFIG_KEY_${count}`]: `http.${scope}.sslVerify`,
			[`GIT_CONFIG_VALUE_${count}`]: "true",
			[`GIT_CONFIG_KEY_${count + 1}`]: `http.${scope}.schannelUseSSLCAInfo`,
			[`GIT_CONFIG_VALUE_${count + 1}`]: "true",
		});
	} catch (error) {
		if (String(error).includes(proxyCAFile)) {
			throw new Error(
				"Git HTTPS proxies are unsupported because Git cannot isolate their CA directories. Use a direct connection or an HTTP proxy; disable remoteOperations for offline use.",
				{ cause: error },
			);
		}
		throw error;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
