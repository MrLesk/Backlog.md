#!/usr/bin/env bash
# Updates bun.nix using bun2nix via Docker
# Run this after updating dependencies (bun install) before committing

set -e

echo "🔄 Regenerating bun.nix using bun2nix..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in PATH"
    echo "   Please install Docker or use Nix directly if available"
    exit 1
fi

# Pin to bun2nix V1 (rev 85d692d) which produces the V1 format compatible with our flake.nix
# The V2 format (function-based) is incompatible with the mkBunDerivation API we use
BUN2NIX_REV="85d692d68a5345d868d3bb1158b953d2996d70f7"

# Run bun2nix in Docker
docker run --rm -v "$(pwd):/app" -w /app nixos/nix:latest \
  nix --extra-experimental-features "nix-command flakes" run "github:baileyluTCD/bun2nix/${BUN2NIX_REV}" -- -o bun.nix

echo "✅ bun.nix has been regenerated successfully"
echo "   Don't forget to commit the updated bun.nix file!"
