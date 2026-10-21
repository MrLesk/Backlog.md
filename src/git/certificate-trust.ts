import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getCACertificates, rootCertificates } from "node:tls";
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

/** Isolate trust for one native Git HTTPS fetch without changing user configuration. */
export async function withGitFetchTrust(
	url: string,
	projectRoot: string,
	caFile: string | undefined,
	caDirectory: string | undefined,
	fetch: (environment: NodeJS.ProcessEnv) => Promise<void>,
): Promise<void> {
	if (caFile === "") throw new Error("Configured Git CA file is empty");
	const bundles =
		caFile || caDirectory
			? []
			: [
					...rootCertificates,
					...getCACertificates("default"),
					...getCACertificates("system"),
					...getCACertificates("extra"),
				];
	if (caFile) bundles.push(await readFile(resolve(projectRoot, caFile), "utf8"));
	if (caDirectory) {
		const directory = resolve(projectRoot, caDirectory);
		for (const name of await readdir(directory)) {
			// OpenSSL CA directories use hashed names; ignore unrelated files and CRLs.
			if (/^[a-f0-9]{8}\.\d+$/i.test(name)) bundles.push(await readFile(join(directory, name), "utf8"));
		}
	}
	const certificates = trustedCertificates(bundles);
	const directory = await mkdtemp(join(tmpdir(), "backlog-git-trust-"));
	try {
		const cafile = join(directory, "ca.pem");
		const empty = join(directory, "empty");
		await mkdir(empty);
		await writeFile(cafile, `${certificates.join("\n")}\n`, { mode: 0o600 });
		// Bun omits undefined environment values. Override every inherited spelling on Windows too.
		const bypass = Object.fromEntries(
			Object.keys(process.env)
				.filter((key) => key.toUpperCase() === "GIT_SSL_NO_VERIFY")
				.map((key) => [key, undefined]),
		);
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
			...bypass,
			GIT_SSL_CAINFO: cafile,
			GIT_SSL_CAPATH: empty,
			SSL_CERT_FILE: cafile,
			SSL_CERT_DIR: empty,
			CURL_CA_BUNDLE: cafile,
			GIT_CONFIG_COUNT: String(count + 2),
			GIT_CONFIG_PARAMETERS: [gitTrustValue("GIT_CONFIG_PARAMETERS"), parameters].filter(Boolean).join(" "),
			[`GIT_CONFIG_KEY_${count}`]: `http.${scope}.sslVerify`,
			[`GIT_CONFIG_VALUE_${count}`]: "true",
			[`GIT_CONFIG_KEY_${count + 1}`]: `http.${scope}.schannelUseSSLCAInfo`,
			[`GIT_CONFIG_VALUE_${count + 1}`]: "true",
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
