# Authenticated multi-user hosting

This guide shows how to host Backlog.md as a shared service for a team — the **web UI**
and the **MCP server** — behind a single OpenID Connect (OIDC) provider, so that every
commit is attributed to the authenticated end-user.

It uses [Keycloak](https://www.keycloak.org/) as the example identity provider and
[oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) as the authenticating
reverse proxy, but any OIDC provider / proxy that forwards identity headers works.

> Backlog.md never talks to the identity provider itself. It trusts the identity that
> the proxy forwards as request headers, and turns it into the **git commit author**.
> The git **committer** always stays the server's own identity.

## Architecture

```
                       ┌──────────────┐
                       │   Keycloak   │  (OIDC provider)
                       └──────┬───────┘
                              │ OIDC
                   ┌──────────┴───────────┐
                   │     oauth2-proxy     │  forwards X-Forwarded-Email /
                   └───┬──────────────┬───┘  X-Forwarded-Preferred-Username
                       │              │
              ┌────────┴───┐   ┌──────┴───────────────┐
              │ backlog    │   │ backlog mcp start    │
              │ browser    │   │ --http               │
              │ (web UI)   │   │ (Streamable HTTP)    │
              └────────┬───┘   └──────┬───────────────┘
                       └───────┬──────┘
                        ┌──────┴───────┐
                        │  Backlog.md  │  auto_pull / auto_push
                        │  git repo    │  + push deploy key
                        └──────┬───────┘
                               │ push / pull
                        ┌──────┴───────┐
                        │ git remote   │
                        └──────────────┘
```

Two consumers, **one identity model**: whether a change comes from the web UI or an AI
agent over MCP, the commit author is the authenticated user from the proxy headers.

## Relevant configuration

```yml
# backlog/config.yml
remote_operations: true

# Keep the shared checkout in sync with the remote automatically
auto_pull: true            # pull --rebase before each operation (CLI/web/MCP)
auto_push: true            # push after each commit

# Attribute commits to the proxied end-user (web UI and MCP HTTP both use this)
commit_author_from_proxy_headers: true
# Header names are configurable; these are the oauth2-proxy defaults:
proxy_author_email_header: x-forwarded-email
proxy_author_name_header: x-forwarded-preferred-username
```

The server git identity (used as the committer) is the ambient git config of the user
running the server:

```bash
git config user.name  "Backlog Server"
git config user.email "backlog@example.com"
```

Give that server a **deploy key** with push access to the remote so `auto_push` works.

## 1. Keycloak

Create a realm (e.g. `backlog`) and two clients:

1. **Web UI** — a *confidential* client, standard authorization-code flow.
   - Valid redirect URI: `https://backlog.example.com/oauth2/callback`
   - Note the client ID and secret.
2. **Agents (MCP)** — depends on the UX you want (see §3):
   - *Service account* client (`Client authentication: On`, `Service accounts roles: On`)
     for headless agents using a Bearer token, **or**
   - a *public* client for interactive OAuth from a desktop MCP client.

Map `email` and `preferred_username` into the tokens (default Keycloak mappers already do).

## 2. Web UI behind oauth2-proxy (browser login)

Run the web UI bound to localhost and put oauth2-proxy in front:

```bash
backlog browser --port 6420 --no-open
```

```bash
oauth2-proxy \
  --provider=keycloak-oidc \
  --oidc-issuer-url=https://keycloak.example.com/realms/backlog \
  --client-id=backlog-web --client-secret=$WEB_CLIENT_SECRET \
  --redirect-url=https://backlog.example.com/oauth2/callback \
  --upstream=http://127.0.0.1:6420 \
  --email-domain='*' \
  --pass-user-headers=true \
  --cookie-secret=$COOKIE_SECRET \
  --http-address=0.0.0.0:443
```

`--pass-user-headers=true` forwards `X-Forwarded-Email` and
`X-Forwarded-Preferred-Username` to the upstream — which is exactly what
`commit_author_from_proxy_headers` reads. A human just sees a Keycloak login screen.

## 3. MCP over HTTP

Start the MCP server with the HTTP transport (single shared process, stateless):

```bash
backlog mcp start --http --port 6421 --host 127.0.0.1
```

Put it behind oauth2-proxy as well. **An MCP client is not a browser**, so there are two
authentication UX options.

### Option A — Bearer token (no interaction; best for agents)

The MCP client sends an `Authorization: Bearer <token>` header. Configure oauth2-proxy to
accept and validate JWT bearer tokens (in addition to, or instead of, the cookie flow):

```bash
oauth2-proxy \
  --provider=keycloak-oidc \
  --oidc-issuer-url=https://keycloak.example.com/realms/backlog \
  --client-id=backlog-web --client-secret=$WEB_CLIENT_SECRET \
  --upstream=http://127.0.0.1:6421 \
  --skip-jwt-bearer-tokens=true \
  --pass-user-headers=true \
  --email-domain='*' \
  --cookie-secret=$COOKIE_SECRET \
  --http-address=0.0.0.0:8443
```

Obtain a token from Keycloak (e.g. a service-account client-credentials grant for an
agent), then point the MCP client at the URL with the header. Example client entry:

```json
{
  "mcpServers": {
    "backlog": {
      "type": "http",
      "url": "https://backlog-mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer <ACCESS_TOKEN>" }
    }
  }
}
```

No link to click, no code to paste — ideal for automation and CI. The commit author will
be the identity carried by the token (e.g. the service account, or the user the token was
issued for).

### Option B — interactive OAuth (browser login once; for humans)

Some desktop MCP clients can perform the OAuth authorization-code flow against a remote
MCP server: the client opens a browser **once**, the user logs in to Keycloak, and the
client then stores and refreshes the access token automatically. If your client does not
implement remote OAuth directly, the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote)
bridge can handle the flow for it:

```json
{
  "mcpServers": {
    "backlog": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://backlog-mcp.example.com/mcp"]
    }
  }
}
```

This is the "click a link, sign in" experience — convenient for a human, but unnecessary
for an unattended agent (use Option A there).

## Security notes

- Bind `backlog browser` and `backlog mcp start --http` to `127.0.0.1` (or a private
  interface) so they are only reachable **through** the proxy.
- The HTTP MCP transport is **stateless**: a fresh, watcher-free server is built per
  request, so requests are isolated and the deployment scales horizontally.
- The proxy is the trust boundary. Backlog.md attributes the **author** from the
  forwarded headers but never changes the **committer**, so the server identity remains
  auditable.
- With multiple users committing through one server, `auto_pull` (pull-before) plus
  Backlog.md's task-id locking minimise non-fast-forward pushes; `auto_push` shares each
  commit immediately.
