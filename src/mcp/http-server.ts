/**
 * MCP server over Streamable HTTP (Web Standard transport).
 *
 * Runs the Backlog.md MCP server as a single long-lived HTTP service instead of a
 * per-client stdio process. Designed to sit behind an authenticating reverse proxy
 * (e.g. oauth2-proxy): the proxy forwards the end-user identity as headers, and each
 * request's resulting git commit is attributed to that user — the same
 * `commit_author_from_proxy_headers` model as the web UI.
 *
 * Stateless mode: a fresh transport + MCP server is built per request, so requests
 * are independent and horizontally scalable. The per-request server is constructed
 * with filesystem watchers disabled.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { runWithCommitAuthor } from "../git/commit-context.ts";
import { authorFromProxyHeaders } from "../git/proxy-identity.ts";
import { createMcpServer } from "./server.ts";

export interface HttpMcpOptions {
	port: number;
	host?: string;
	debug?: boolean;
	/** MCP endpoint path (default `/mcp`). */
	path?: string;
}

/**
 * Start the MCP Streamable-HTTP server. Returns the Bun server handle.
 */
export function startHttpMcpServer(projectRoot: string, options: HttpMcpOptions) {
	const host = options.host ?? "127.0.0.1";
	const mcpPath = options.path ?? "/mcp";

	const server = Bun.serve({
		port: options.port,
		hostname: host,
		idleTimeout: 0,
		fetch: async (req: Request): Promise<Response> => {
			const url = new URL(req.url);

			if (url.pathname === "/health") {
				return Response.json({ status: "ok" });
			}

			if (url.pathname !== mcpPath) {
				return new Response("Not Found", { status: 404 });
			}

			// Build a request-scoped MCP server (no watchers) and a stateless transport.
			const mcp = await createMcpServer(projectRoot, {
				debug: options.debug,
				pinned: true,
				enableWatchers: false,
			});
			const config = await mcp.filesystem.loadConfig();
			const author = authorFromProxyHeaders(req.headers, config);

			const transport = new WebStandardStreamableHTTPServerTransport({
				// Stateless: no session id generator.
				sessionIdGenerator: undefined,
				// Plain JSON responses (no SSE) — simplest behind a proxy.
				enableJsonResponse: true,
			});
			await mcp.getServer().connect(transport);

			// Attribute any commit produced by this request to the proxied end-user.
			return runWithCommitAuthor(author, () => transport.handleRequest(req));
		},
		error(error: Error) {
			return new Response(`Internal Server Error: ${error?.message ?? "unknown"}`, { status: 500 });
		},
	});

	if (options.debug) {
		console.error(`Backlog.md MCP server (Streamable HTTP) listening on http://${host}:${options.port}${mcpPath}`);
	}

	return server;
}
