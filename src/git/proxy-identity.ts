import type { BacklogConfig } from "../types/index.ts";

/** Minimal header accessor shared by the web server (Request) and the MCP HTTP transport. */
export interface HeaderGetter {
	get(name: string): string | null;
}

/**
 * Build a git author string (`Name <email>`) from auth-proxy identity headers
 * (e.g. forwarded by oauth2-proxy). Returns undefined unless
 * `commitAuthorFromProxyHeaders` is enabled and at least one configured header
 * is present. Header names are configurable and default to the oauth2-proxy
 * conventions (`x-forwarded-email` / `x-forwarded-preferred-username`).
 *
 * Shared by the web server and the MCP Streamable-HTTP transport so both attribute
 * commits to the authenticated end-user the same way.
 */
export function authorFromProxyHeaders(headers: HeaderGetter, config: BacklogConfig | null): string | undefined {
	if (!config?.commitAuthorFromProxyHeaders) return undefined;
	const emailHeader = config.proxyAuthorEmailHeader || "x-forwarded-email";
	const nameHeader = config.proxyAuthorNameHeader || "x-forwarded-preferred-username";
	const get = (name: string) => headers.get(name)?.trim() || undefined;
	const email = get(emailHeader);
	const name = get(nameHeader) || email;
	if (!email && !name) return undefined;
	return `${name ?? email} <${email ?? "unknown@localhost"}>`;
}
