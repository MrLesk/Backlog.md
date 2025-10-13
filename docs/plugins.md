# Plugin Architecture

Backlog.md supports a plugin system that allows extending the CLI with additional commands without modifying the core codebase. This document explains how the plugin system works and how to create your own plugins.

## How Plugins Work

The plugin system follows the git plugin pattern (similar to `git-lfs`, `git-flow`, etc.):

1. **Plugin Discovery**: When you run `backlog <command>`, the CLI first checks if `<command>` is a core command (like `task`, `board`, `init`, etc.)
2. **Plugin Routing**: If the command is not a core command, the CLI looks for an executable named `backlog-<command>` in your PATH or `node_modules/.bin`
3. **Plugin Execution**: If found, the plugin is executed with the remaining arguments, and its output is forwarded directly to your terminal

## Using Plugins

### Installing a Plugin

Plugins can be installed globally or as project dependencies:

```bash
# Global installation (recommended for CLI tools)
npm install -g backlog-jira
# or
bun install -g backlog-jira

# Project-local installation
npm install --save-dev backlog-jira
# or  
bun add -d backlog-jira
```

### Using a Plugin

Once installed, you can use the plugin just like any other backlog command:

```bash
# If you have backlog-jira installed:
backlog jira sync
backlog jira push task-123
backlog jira pull --all

# If you have backlog-github installed:
backlog github sync
backlog github create-pr task-456
```

## Creating a Plugin

### Plugin Requirements

A backlog plugin must:

1. Be an executable named `backlog-<plugin-name>`
2. Be available in PATH or installed in `node_modules/.bin`
3. Handle its own command-line arguments
4. Exit with appropriate exit codes (0 for success, non-zero for errors)

### Example Plugin Structure

Here's a minimal example of a backlog plugin in TypeScript/Bun:

#### package.json

```json
{
  "name": "backlog-myplugin",
  "version": "1.0.0",
  "bin": {
    "backlog-myplugin": "./dist/index.js"
  },
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target node",
    "prepublishOnly": "bun run build"
  }
}
```

#### src/index.ts

```typescript
#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("backlog-myplugin")
  .description("My awesome backlog plugin")
  .version("1.0.0");

program
  .command("hello")
  .description("Say hello")
  .action(() => {
    console.log("Hello from myplugin!");
  });

program.parse(process.argv);
```

### Building Your Plugin

```bash
# Build the plugin
bun run build

# Install locally for testing
npm link
# or
bun link

# Test it
backlog myplugin hello
```

### Publishing Your Plugin

```bash
npm publish
# or
bun publish
```

## Plugin Best Practices

### 1. Clear Command Structure

Use a hierarchical command structure with Commander.js or similar:

```bash
backlog myplugin sync        # Good
backlog myplugin s           # Bad (unclear abbreviation)
```

### 2. Exit Codes

Always exit with appropriate codes:
- `0`: Success
- `1`: General error
- `2`: Invalid usage/arguments

### 3. Error Messages

Provide clear, actionable error messages:

```typescript
if (!config) {
  console.error("Error: Plugin configuration not found.");
  console.error("Run 'backlog myplugin init' to set up the plugin.");
  process.exit(1);
}
```

### 4. Help Documentation

Implement `--help` for every command:

```typescript
program
  .command("sync")
  .description("Synchronize data with external service")
  .option("--dry-run", "Preview changes without applying them")
  .action(async (options) => {
    // Implementation
  });
```

### 5. Configuration

Store plugin configuration separately from core backlog config:

```typescript
// Good: Plugin-specific config file
const configPath = path.join(process.cwd(), ".backlog-myplugin.json");

// Avoid: Modifying core backlog config
```

### 6. Zero Coupling

Never import or depend on backlog.md core internals. Use the CLI interface:

```typescript
// Good: Use CLI commands
import { exec } from "child_process";
const { stdout } = await exec("backlog task list --plain");

// Bad: Import core modules
import { Core } from "backlog.md"; // DON'T DO THIS
```

## Available Plugins

### Official Plugins

- **[backlog-jira](https://github.com/your-org/backlog-jira)**: Bidirectional sync with Jira
- **[backlog-github](https://github.com/your-org/backlog-github)**: GitHub integration for issues and PRs

### Community Plugins

*(Add your plugin here by submitting a PR)*

## Plugin Development Tips

### Testing Locally

During development, use `npm link` or `bun link` to test your plugin without publishing:

```bash
# In your plugin directory
npm link

# Now 'backlog myplugin' will use your local version
backlog myplugin test

# When done testing
npm unlink -g backlog-myplugin
```

### Debugging

Set DEBUG environment variable for verbose output:

```bash
DEBUG=* backlog myplugin command
```

### TypeScript Support

For TypeScript plugins, ensure your build outputs executable JavaScript:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

## Plugin Architecture Details

### How Core Routes to Plugins

The core CLI implements a simple routing mechanism:

1. Parse raw command-line arguments
2. Check if first argument is a known core command
3. If not, attempt to find `backlog-<arg>` executable
4. If found, spawn the process with remaining arguments and forward stdio
5. If not found, show helpful error message with installation instructions

### No Core Modifications Needed

The beauty of this architecture is that:

- Core CLI never needs to know about specific plugins
- Plugins can be developed and published independently
- No version coupling between core and plugins
- Clean separation of concerns

## Troubleshooting

### Plugin Not Found

If you get "Plugin not found" error:

1. Verify the plugin is installed: `npm list -g backlog-*`
2. Check if executable is in PATH: `which backlog-myplugin`
3. Verify file permissions: `ls -l $(which backlog-myplugin)`
4. Try reinstalling: `npm install -g backlog-myplugin --force`

### Plugin Not Executing

If the plugin is found but not executing:

1. Check if file has execute permissions: `chmod +x /path/to/backlog-myplugin`
2. Verify shebang line: First line should be `#!/usr/bin/env node`
3. Check for JavaScript syntax errors: Run the file directly to see errors

## Contributing

We welcome plugin contributions! To get your plugin listed in this documentation:

1. Ensure your plugin follows the best practices above
2. Publish it to npm
3. Submit a PR adding it to the "Community Plugins" section

For questions or support, open an issue on the [backlog.md GitHub repository](https://github.com/your-org/backlog.md).
