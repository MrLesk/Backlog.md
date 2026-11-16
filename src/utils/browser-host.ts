export const DEFAULT_BROWSER_HOSTNAME = "127.0.0.1";

export const REMOTE_ACCESS_WARNING =
	"WARNING: INSECURE REMOTE ACCESS\n" +
	"Anyone who can reach this server can read and change Backlog data and project configuration without authentication.\n" +
	"Status-change commands can execute with your account's permissions, allowing access to other local files and credentials.\n" +
	"HTTP traffic is not encrypted. Do not expose this server to the public internet.";

export function normalizeBrowserHostname(value: unknown): string {
	const invalid = () =>
		new Error("Invalid browser hostname: use a hostname or IP address without a protocol, port, or path.");
	if (typeof value !== "string" || !value.trim() || /[\s/\\?#@%]/.test(value.trim())) throw invalid();
	if (value.trim().startsWith("[") && !value.includes(":")) throw invalid();
	const hostname = value.trim().replace(/^\[(.*)\]$/, "$1");
	try {
		const url = new URL(`http://${hostname.includes(":") ? `[${hostname}]` : hostname}`);
		if (url.port || !url.hostname) throw invalid();
		const normalized = url.hostname.replace(/^\[(.*)\]$/, "$1");
		if (
			!normalized.includes(":") &&
			(normalized.length > 253 ||
				!normalized
					.replace(/\.$/, "")
					.split(".")
					.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))
		)
			throw invalid();
		return normalized;
	} catch {
		throw invalid();
	}
}

/** Unknown names may resolve outside loopback. The server checks the resolved listening address. */
export function isLoopbackBrowserHostname(value: string): boolean {
	let hostname: string;
	try {
		hostname = normalizeBrowserHostname(value);
	} catch {
		return false;
	}
	return (
		hostname === "localhost" ||
		hostname === "localhost." ||
		hostname === "::1" ||
		/^127\.\d+\.\d+\.\d+$/.test(hostname) ||
		/^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(hostname)
	);
}

export function browserUrl(hostname: string, port: number): string {
	const localHostname = hostname === "0.0.0.0" ? DEFAULT_BROWSER_HOSTNAME : hostname === "::" ? "::1" : hostname;
	return `http://${localHostname.includes(":") ? `[${localHostname}]` : localHostname}:${port}`;
}
