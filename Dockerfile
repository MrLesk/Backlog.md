# Runs Backlog.md's MCP server (stdio) behind a supergateway bridge so it can
# be reached over HTTP/SSE by a remote AI client instead of only being spawned
# locally by an editor. See entrypoint.sh for the runtime wiring.
FROM oven/bun:1

RUN apt-get update \
	&& apt-get install -y --no-install-recommends git openssh-client ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# The target repo is bind-mounted here at runtime (see docker-compose.yml).
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
