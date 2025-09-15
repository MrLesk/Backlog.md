---
id: task-265.13
title: Implement OAuth2 authentication support
status: To Do
assignee: []
created_date: '2025-09-15 12:30'
labels:
  - mcp
  - security
  - authentication
dependencies: ['task-265.11']
parent_task_id: task-265
priority: high
---

## Description

Implement comprehensive OAuth2 authentication flow for MCP servers to support secure authentication with external agents and services, following Claude Code MCP best practices.

### Technical Context

OAuth2 authentication is a key requirement for Claude Code MCP integration and provides secure token-based authentication for HTTP/SSE transports. This implementation will support:

- **Token Management**: Automatic token refresh and secure storage
- **Multiple Providers**: Support for different OAuth2 providers
- **Environment Configuration**: Secure configuration via environment variables
- **Token Validation**: Proper token validation and expiry handling

### Implementation Details

**OAuth2 Configuration Types (`/src/mcp/auth/types.ts`):**
```typescript
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: number;
}

export interface OAuth2TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface OAuth2Error {
  error: string;
  error_description?: string;
  error_uri?: string;
}
```

**OAuth2 Client Implementation (`/src/mcp/auth/oauth2-client.ts`):**
```typescript
export class OAuth2Client {
  private config: OAuth2Config;
  private tokenStore: TokenStore;

  constructor(config: OAuth2Config) {
    this.config = config;
    this.tokenStore = new TokenStore();
  }

  async getAccessToken(): Promise<string> {
    // Check if current token is valid
    if (this.isTokenValid()) {
      return this.config.accessToken!;
    }

    // Refresh token if available
    if (this.config.refreshToken) {
      return await this.refreshAccessToken();
    }

    throw new Error('No valid access token available');
  }

  private async refreshAccessToken(): Promise<string> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken!,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error: OAuth2Error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const tokenResponse: OAuth2TokenResponse = await response.json();

    // Update configuration with new tokens
    this.config.accessToken = tokenResponse.access_token;
    if (tokenResponse.refresh_token) {
      this.config.refreshToken = tokenResponse.refresh_token;
    }
    this.config.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);

    // Store tokens securely
    await this.tokenStore.storeTokens(this.config);

    return tokenResponse.access_token;
  }

  private isTokenValid(): boolean {
    if (!this.config.accessToken || !this.config.tokenExpiry) {
      return false;
    }

    // Check if token expires within 5 minutes
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return this.config.tokenExpiry > fiveMinutesFromNow;
  }
}
```

**Secure Token Storage (`/src/mcp/auth/token-store.ts`):**
```typescript
export class TokenStore {
  private keychain: Keychain;

  constructor() {
    // Use system keychain on macOS/Windows, keyring on Linux
    this.keychain = new Keychain('backlog-md-mcp');
  }

  async storeTokens(config: OAuth2Config): Promise<void> {
    const tokenData = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      tokenExpiry: config.tokenExpiry,
    };

    await this.keychain.setPassword(
      'oauth-tokens',
      config.clientId,
      JSON.stringify(tokenData)
    );
  }

  async loadTokens(clientId: string): Promise<Partial<OAuth2Config>> {
    try {
      const tokenData = await this.keychain.getPassword('oauth-tokens', clientId);
      return JSON.parse(tokenData);
    } catch (error) {
      // No stored tokens found
      return {};
    }
  }

  async clearTokens(clientId: string): Promise<void> {
    await this.keychain.deletePassword('oauth-tokens', clientId);
  }
}
```

**Authentication Middleware (`/src/mcp/auth/middleware.ts`):**
```typescript
export class AuthenticationMiddleware {
  private oauth2Client?: OAuth2Client;

  constructor(authConfig: McpAuthConfig) {
    if (authConfig.type === 'oauth2' && authConfig.oauth) {
      this.oauth2Client = new OAuth2Client(authConfig.oauth);
    }
  }

  async authenticate(request: any): Promise<boolean> {
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      return false;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      return false;
    }

    // For OAuth2, validate token with provider
    if (this.oauth2Client) {
      return await this.validateOAuth2Token(token);
    }

    return false;
  }

  private async validateOAuth2Token(token: string): Promise<boolean> {
    try {
      // Simple validation - check if token matches current access token
      const currentToken = await this.oauth2Client!.getAccessToken();
      return token === currentToken;
    } catch (error) {
      return false;
    }
  }
}
```

**CLI Integration (`/src/cli.ts` - MCP auth commands):**
```typescript
// Add OAuth2 commands to MCP command group
mcpCmd
  .command('auth')
  .description('Manage OAuth2 authentication')
  .option('--status', 'Show authentication status')
  .option('--refresh', 'Refresh access token')
  .option('--clear', 'Clear stored tokens')
  .action(async (options) => {
    if (options.status) {
      await showAuthStatus();
    } else if (options.refresh) {
      await refreshTokens();
    } else if (options.clear) {
      await clearStoredTokens();
    } else {
      console.log('Use --status, --refresh, or --clear');
    }
  });

async function showAuthStatus() {
  const config = await getConfig();
  const authConfig = getMcpConfig(config).http.auth;

  if (authConfig.type === 'oauth2') {
    console.log('OAuth2 authentication configured');
    // Check token validity without exposing sensitive data
    const oauth2Client = new OAuth2Client(authConfig.oauth!);
    const isValid = await oauth2Client.isTokenValid();
    console.log(`Token status: ${isValid ? 'Valid' : 'Expired/Invalid'}`);
  } else {
    console.log('OAuth2 authentication not configured');
  }
}
```

**Environment Variable Support:**
```bash
# OAuth2 configuration via environment variables
BACKLOG_MCP_OAUTH_CLIENT_ID=your_client_id
BACKLOG_MCP_OAUTH_CLIENT_SECRET=your_client_secret
BACKLOG_MCP_OAUTH_TOKEN_URL=https://auth.example.com/oauth/token
BACKLOG_MCP_OAUTH_SCOPES=read,write
```

**Configuration Integration:**
```typescript
// Update getMcpConfig to support environment variables
export function getMcpConfig(config: BacklogConfig): McpConfig {
  // ... existing code ...

  // Override with environment variables if available
  if (process.env.BACKLOG_MCP_OAUTH_CLIENT_ID) {
    mcpConfig.http.auth.type = 'oauth2';
    mcpConfig.http.auth.oauth = {
      clientId: process.env.BACKLOG_MCP_OAUTH_CLIENT_ID,
      clientSecret: process.env.BACKLOG_MCP_OAUTH_CLIENT_SECRET!,
      tokenUrl: process.env.BACKLOG_MCP_OAUTH_TOKEN_URL!,
      scopes: process.env.BACKLOG_MCP_OAUTH_SCOPES?.split(','),
    };
  }

  return mcpConfig;
}
```

### Security Considerations

- **Token Storage**: Use system keychain/keyring for secure token storage
- **Environment Variables**: Support secure configuration via environment variables
- **Token Validation**: Proper token expiry and refresh handling
- **Error Handling**: Secure error messages without token exposure
- **HTTPS Only**: OAuth2 only works over HTTPS in production

### Integration Points

- **HTTP Transport**: Integrate with existing HTTP transport authentication
- **Configuration System**: Extend MCP configuration with OAuth2 settings
- **CLI Commands**: Add OAuth2 management commands
- **Documentation**: Update setup guides with OAuth2 examples

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] OAuth2 client implementation with token refresh
- [ ] Secure token storage using system keychain
- [ ] Authentication middleware for HTTP transport
- [ ] CLI commands for OAuth2 management (auth status, refresh, clear)
- [ ] Environment variable configuration support
- [ ] Integration with existing MCP configuration system
- [ ] Proper error handling and validation
- [ ] Token expiry monitoring and automatic refresh
- [ ] Documentation and setup examples
- [ ] Unit tests for OAuth2 functionality
<!-- AC:END -->