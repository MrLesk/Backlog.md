{
  description = "Backlog.md - A markdown-based task management CLI tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    bun2nix = {
      url = "github:nix-community/bun2nix/2.1.2";
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
          # Scope the Brotli fix to developer network tools, avoiding a Nixpkgs-wide rebuild.
          brotliRuntime = pkgs.brotli.overrideAttrs (old: {
            patches = (old.patches or [ ]) ++ [
              (pkgs.fetchurl {
                # CVE-2026-111497; the same upstream fix shipped in Node 26.12.1.
                url = "https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b.patch";
                hash = "sha256-gzyh1x7thb3jwhxjpu4xATh3Qbiqi5qCJRNAlKZ3thk=";
              })
            ];
          });
          curlRuntime = pkgs.curl.override { brotli = brotliRuntime; };
          gitRuntime = pkgs.git.override { curl = curlRuntime; };
          avx2BunArchive = pkgs.fetchurl {
            # Pin an AVX2-only control independently of the packaged Bun runtime.
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.13/bun-linux-x64.zip";
            hash = "sha256-ecB3H6i5LDOq5B4VoODTB+qZ0OLwAxfHHGxTI3p44lo=";
          };
          packageJson = builtins.fromJSON (builtins.readFile ./package.json);
          bunDeps = pkgs.bun2nix.fetchBunDeps {
            bunNix = ./bun.nix;
            overrides = pkgs.bun2nix.patchedDependenciesToOverrides {
              patchedDependencies = pkgs.lib.mapAttrs (_: path: ./. + "/${path}") (
                packageJson.patchedDependencies or { }
              );
            };
          };
          bunRuntime = pkgs.bun.overrideAttrs (final: bun: {
            version = "1.4.4";
            src = final.passthru.sources.${system};
            passthru = bun.passthru // {
              sources = {
                aarch64-darwin = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-darwin-aarch64.zip";
                  hash = "sha256-wkDX8My5DCY6hJ/NsJt+5iYw2SE0jtaq/ahrnVd7xRA=";
                };
                aarch64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-aarch64.zip";
                  hash = "sha256-uqa7NvUdblhWHgK76oJQOKnfRU9nPW13bou/hvjHhQ4=";
                };
                x86_64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-x64.zip";
                  hash = "sha256-v4zL+ysLgBWeD5ptFcVTF63YB3U028YTCj7bUvzLOVw=";
                };
              };
            };
          });
          nodeSource = {
            x86_64-linux = {
              platform = "linux-x64";
              hash = "sha256-YXCy1HThxib0PP863BGN+f47VzJYpPw9hQyNvGsHm70=";
            };
            aarch64-linux = {
              platform = "linux-arm64";
              hash = "sha256-QqoEkiWR7l1NvHdA1FJiGs8oUII52qUS9e6MR+4iT9s=";
            };
            aarch64-darwin = {
              platform = "darwin-arm64";
              hash = "sha256-GIML9Ej+GHxlDcKMmKqMlo7R1Att0DLAgecKOEob9mA=";
            };
          }.${system};
          npmSource = pkgs.fetchurl {
            url = "https://registry.npmjs.org/npm/-/npm-12.2.1.tgz";
            hash = "sha512-bKCmFRVT/BB+YPEYbZwQ1XUI3N5t4xKSpU1MxOjo7z3iWzKBJ0ZXRC1xFdEN+TC7N5TdywaBzf2dMXGJq/e2PQ==";
          };
          # Preserve the release's security fixes instead of relinking older Nixpkgs libraries.
          nodeRuntime = pkgs.stdenvNoCC.mkDerivation rec {
            pname = "nodejs";
            version = "26.12.1";
            src = pkgs.fetchurl {
              url = "https://nodejs.org/dist/v${version}/node-v${version}-${nodeSource.platform}.tar.xz";
              inherit (nodeSource) hash;
            };
            nativeBuildInputs = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [
              pkgs.patchelf
            ];
            buildInputs = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [
              pkgs.stdenv.cc.cc.lib
            ];
            dontConfigure = true;
            dontBuild = true;
            dontStrip = true;
            dontPatchELF = true;
            # Header sorting in patchelf 0.19.2 makes the official Node executable segfault.
            postFixup = pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
              patchelf --no-sort \
                --set-interpreter ${pkgs.stdenv.cc.bintools.dynamicLinker} \
                --set-rpath ${pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib pkgs.stdenv.cc.cc.libgcc ]} \
                "$out/bin/node"
            '';
            installPhase = ''
              runHook preInstall
              mkdir -p "$out"
              cp -R bin include lib share "$out/"
              rm -rf "$out/lib/node_modules/npm"
              mkdir -p "$out/lib/node_modules/npm"
              tar -xzf ${npmSource} --strip-components=1 -C "$out/lib/node_modules/npm"
              for script in npm-cli.js npx-cli.js; do
                substituteInPlace "$out/lib/node_modules/npm/bin/$script" \
                  --replace-fail '#!/usr/bin/env node' "#!$out/bin/node"
              done
              runHook postInstall
            '';
            doInstallCheck = true;
            installCheckPhase = ''
              runHook preInstallCheck
              node_version="$("$out/bin/node" --version)"
              npm_version="$("$out/bin/node" "$out/lib/node_modules/npm/bin/npm-cli.js" --version)"
              echo "Packaged Node: $node_version; npm: $npm_version"
              test "$node_version" = "v${version}"
              test "$npm_version" = "12.2.1"
              test "$(head -n 1 "$out/lib/node_modules/npm/bin/npm-cli.js")" = "#!$out/bin/node"
              test "$(head -n 1 "$out/lib/node_modules/npm/bin/npx-cli.js")" = "#!$out/bin/node"
              runHook postInstallCheck
            '';
          };
          trustedCA = pkgs.runCommand "backlog-trusted-ca" {
            nativeBuildInputs = [ nodeRuntime ];
          } ''
            node -e 'require("node:fs").writeFileSync("node-roots.pem", require("node:tls").rootCertificates.join("\n"))'
            node ${./scripts/filter-trusted-cas.cjs} node-roots.pem "$out"
          '';
          # Git has no proxy CApath setting. A path beneath this regular file cannot
          # load, blocking HTTPS proxies before HTTP/auth; empty CAfiles can fall back.
          blockedProxyCA = pkgs.writeText "backlog-unsupported-https-proxy-ca.pem" "";
          buildTrust = {
            SSL_CERT_FILE = "${trustedCA}/ca-bundle.crt";
            SSL_CERT_DIR = "${trustedCA}/empty";
            NODE_EXTRA_CA_CERTS = "${trustedCA}/ca-bundle.crt";
            NODE_OPTIONS = "--use-openssl-ca";
            NODE_USE_SYSTEM_CA = "0";
            GIT_SSL_CAINFO = "${trustedCA}/ca-bundle.crt";
            GIT_SSL_CAPATH = "${trustedCA}/empty";
            GIT_PROXY_SSL_CAINFO = "${blockedProxyCA}/unavailable.pem";
            CURL_CA_BUNDLE = "${trustedCA}/ca-bundle.crt";
            NPM_CONFIG_CAFILE = "${trustedCA}/ca-bundle.crt";
            NIX_SSL_CERT_FILE = "${trustedCA}/ca-bundle.crt";
          };
          backlog-md = pkgs.bun2nix.mkDerivation {
            pname = "backlog";
            inherit (packageJson) version;
            src = ./.;

            inherit bunDeps;
            nativeBuildInputs = [
              bunRuntime
              pkgs.makeWrapper
            ];
            bunInstallFlags = [
              "--linker=isolated"
              "--backend=copyfile"
            ];
            dontRunLifecycleScripts = true;
            dontUseBunCheck = true;
            postBunSetInstallCacheDirPhase = ''
              export PATH=${bunRuntime}/bin:$PATH
            '';

            buildPhase = ''
              runHook preBuild

              BACKLOG_BUILD_VERSION="$version" \
                BACKLOG_BUILD_OUTDIR=dist/nix \
                ${bunRuntime}/bin/bun scripts/build.ts

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
            # The packaged browser smoke binds localhost inside the Darwin sandbox.
            __darwinAllowLocalNetworking = pkgs.stdenv.hostPlatform.isDarwin;
            nativeInstallCheckInputs = pkgs.lib.optionals (system == "x86_64-linux") [
              pkgs.qemu-user
              pkgs.unzip
            ];
            installCheckPhase = ''
              runHook preInstallCheck

              ${bunRuntime}/bin/bun scripts/smoke-compiled-build.ts "$out/bin/backlog" "$version"

              ${pkgs.lib.optionalString (system == "x86_64-linux") ''
                mkdir -p "$TMPDIR/avx2-bun"
                unzip -q ${avx2BunArchive} -d "$TMPDIR/avx2-bun"
                ln -s ${pkgs.stdenv.cc.libc}/lib "$TMPDIR/avx2-bun/lib64"

                set +e
                BUN_JSC_useJIT=false qemu-x86_64 -L "$TMPDIR/avx2-bun" -cpu IvyBridge \
                  "$TMPDIR/avx2-bun/bun-linux-x64/bun" --version >/dev/null 2>&1
                avx2_status=$?
                set -e
                if [ "$avx2_status" -ne 132 ]; then
                  echo "QEMU compatibility check expected AVX2 Bun to exit 132, got $avx2_status" >&2
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

          checks.development-tools = pkgs.runCommand "backlog-development-tools" (buildTrust // {
            nativeBuildInputs = [ nodeRuntime curlRuntime gitRuntime ];
          }) ''
            node -e 'const assert = require("node:assert/strict"); assert.equal(process.version, "v26.12.1"); assert.equal(process.versions.ares, "1.34.9"); assert.equal(typeof require("node:zlib").constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH, "number");'
            test "$(npm --version)" = "12.2.1"
            test -s "$SSL_CERT_FILE"
            test -d "$SSL_CERT_DIR"
            test -f "$(dirname "$GIT_PROXY_SSL_CAINFO")"
            test ! -e "$GIT_PROXY_SSL_CAINFO"
            git --version
            curl --version
            touch "$out"
          '';

          apps.default = flake-utils.lib.mkApp {
            drv = backlog-md;
            name = "backlog";
          };

          devShells.default = pkgs.mkShell {
            packages = [
              bunRuntime
              pkgs.bun2nix
              nodeRuntime
              gitRuntime
              curlRuntime
            ];
          };
        }
      );
}
