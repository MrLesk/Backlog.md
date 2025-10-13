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

# Run bun2nix in Docker
docker run --rm -v "$(pwd):/app" -w /app nixos/nix:latest \
  nix --extra-experimental-features "nix-command flakes" run github:baileyluTCD/bun2nix -- -o bun.nix

echo "✅ bun.nix has been regenerated successfully"
echo "   Don't forget to commit the updated bun.nix file!"
