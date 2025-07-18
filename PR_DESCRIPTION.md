## Summary
Add comprehensive NixOS packaging support to enable installation via the NixOS package manager. This implementation provides a complete Nix flake that allows NixOS users to easily install and run Backlog.md using standard Nix commands like `nix run github:MrLesk/Backlog.md`.

## Related Tasks
Closes task-196

## Task Checklist
- [x] I have created a corresponding task in `backlog/tasks/`
- [x] The task has clear acceptance criteria
- [x] I have added an implementation plan to the task
- [x] All acceptance criteria in the task are marked as completed

## Testing
Thoroughly tested the NixOS packaging implementation:

### Build Testing
- ✅ `nix build` - Package builds successfully creating executable binary
- ✅ `nix flake lock` - Lockfile generates properly with pinned dependencies
- ✅ Version embedding works correctly (displays 1.5.0 instead of 0.0.0)
- ✅ Dynamic version reading from package.json works in flake

### Runtime Testing  
- ✅ `nix run . -- --version` - CLI displays correct version (1.5.0)
- ✅ `nix run . -- --help` - Help command works properly showing all options
- ✅ Basic CLI functionality verified (commands execute without errors)
- ✅ Development shell works: `nix develop` provides Bun, Node.js, Git, Biome

### Code Quality & Standards
- ✅ Follows Nix community best practices (stdenv.mkDerivation, proper meta)
- ✅ Proper meta information included (description, homepage, license, platforms)
- ✅ Development shell provided via `nix develop` with all dependencies
- ✅ Documentation updated with NixOS installation instructions in README
- ✅ Reproducible builds with frozen lockfile
- ✅ Clean separation of build phases (preBuild, build, postBuild hooks)

### Files Modified
- **`flake.nix`** - Complete Nix flake definition with proper derivation for Bun builds
- **`flake.lock`** - Generated lockfile for reproducible builds across systems
- **`package.json`** - Updated version to 1.5.0 for proper release versioning
- **`README.md`** - Added NixOS installation instructions in header section
- **`backlog/tasks/task-196 - Add-NixOS-packaging-support.md`** - Complete task documentation with implementation details
- **`.gitignore`** - Added `result` directory (Nix build artifact)

### Technical Implementation Details
- Uses `builtins.fromJSON` to dynamically read version from package.json
- Embeds version at build time using `--define "__EMBEDDED_VERSION__="${version}"`
- Supports all platforms that Bun supports (cross-platform compatibility)
- Includes proper build inputs: bun, nodejs_20, git
- Follows standard Nix derivation patterns with runHook support
- Provides both `packages.default` and `apps.default` outputs

This resolves GitHub issue #190 and enables NixOS users to install Backlog.md through their package manager.