{
  description = "Backlog.md - A markdown-based task management CLI tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    bun2nix = {
      url = "github:nix-community/bun2nix/2.1.1";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      bun2nix,
      ...
    }:
    flake-utils.lib.eachSystem
      [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ]
      (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            overlays = [ bun2nix.overlays.default ];
          };
          packageJson = builtins.fromJSON (builtins.readFile ./package.json);
          bunDeps = pkgs.bun2nix.fetchBunDeps {
            bunNix = ./bun.nix;
          };
          bunRuntime =
            if system == "x86_64-linux" then
              pkgs.bun.overrideAttrs (previous: {
                passthru = previous.passthru // {
                  sources = previous.passthru.sources // {
                    x86_64-linux = pkgs.fetchurl {
                      # Keep this on Bun's baseline archive. The normal x64 build requires AVX2.
                      url = "https://github.com/oven-sh/bun/releases/download/bun-v${previous.version}/bun-linux-x64-baseline.zip";
                      hash = "sha256-nYokKSpwaAkCBdqsCloiP19pc29Sh+N7+I07QDHtx1A=";
                    };
                  };
                };
              })
            else
              pkgs.bun;
          backlog-md = pkgs.bun2nix.mkDerivation {
            pname = "backlog";
            inherit (packageJson) version;
            src = ./.;

            inherit bunDeps;
            nativeBuildInputs = [ pkgs.makeWrapper ];
            bunInstallFlags = [
              "--linker=isolated"
              "--backend=copyfile"
            ];
            dontRunLifecycleScripts = true;
            dontUseBunCheck = true;

            buildPhase = ''
              runHook preBuild

              BACKLOG_BUILD_VERSION="$version" \
                BACKLOG_BUILD_OUTDIR=dist/nix \
                bun scripts/build.ts

              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p "$out/lib/backlog"
              cp -R dist/nix/. "$out/lib/backlog/"
              makeWrapper ${bunRuntime}/bin/bun "$out/bin/backlog" \
                --add-flags "$out/lib/backlog/cli.js" \
                --set BACKLOG_BUNDLE_ASSET_DIR "$out/lib/backlog"

              runHook postInstall
            '';

            doInstallCheck = true;
            nativeInstallCheckInputs = pkgs.lib.optionals (system == "x86_64-linux") [ pkgs.qemu-user ];
            installCheckPhase = ''
              runHook preInstallCheck

              bun scripts/smoke-compiled-build.ts "$out/bin/backlog" "$version"

              ${pkgs.lib.optionalString (system == "x86_64-linux") ''
                if BUN_JSC_useJIT=false qemu-x86_64 -cpu IvyBridge \
                  ${pkgs.bun}/bin/bun --version >/dev/null 2>&1; then
                  echo "QEMU compatibility check did not reject the AVX2 Bun runtime" >&2
                  exit 1
                fi

                test "$(BUN_JSC_useJIT=false qemu-x86_64 -cpu IvyBridge ${bunRuntime}/bin/bun "$out/lib/backlog/cli.js" --version)" = "$version"
                BUN_JSC_useJIT=false qemu-x86_64 -cpu IvyBridge \
                  ${bunRuntime}/bin/bun "$out/lib/backlog/cli.js" --help >/dev/null
              ''}

              runHook postInstallCheck
            '';

            meta = {
              description = "A markdown-based task management CLI tool with Kanban board";
              homepage = "https://backlog.md";
              changelog = "https://github.com/MrLesk/Backlog.md/releases";
              license = pkgs.lib.licenses.mit;
              mainProgram = "backlog";
            };
          };
        in
        {
          packages = {
            default = backlog-md;
            backlog-md = backlog-md;
          };

          apps.default = flake-utils.lib.mkApp {
            drv = backlog-md;
            name = "backlog";
          };

          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.bun
              pkgs.bun2nix
              pkgs.nodejs_24
              pkgs.git
              pkgs.biome
            ];
          };
        }
      );
}
