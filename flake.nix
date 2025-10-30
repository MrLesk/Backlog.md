{
  description = "Backlog.md - A markdown-based task management CLI tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    bun2nix = {
      url = "github:baileyluTCD/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, bun2nix }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Read version from package.json
        packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        version = packageJson.version;

        # Use baseline Bun for x86_64-linux to support older CPUs without AVX2
        # This fixes issue #412 where users with older CPUs (i7-3770, i7-3612QE)
        # get "Illegal instruction" errors during the build process.
        #
        # The baseline build targets Nehalem architecture (2008+) with SSE4.2
        # instead of Haswell (2013+) with AVX2, allowing builds on older hardware.
        #
        # For other systems, use the standard Bun from nixpkgs.
        bunPackage = if system == "x86_64-linux" then
          pkgs.stdenv.mkDerivation rec {
            pname = "bun-baseline";
            version = "1.2.23";

            src = pkgs.fetchurl {
              url = "https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-linux-x64-baseline.zip";
              sha256 = "017f89e19e1b40aa4c11a7cf671d3990cb51cc12288a43473238a019a8cafffc";
            };

            nativeBuildInputs = [ pkgs.unzip pkgs.autoPatchelfHook ];

            buildInputs = with pkgs; [
              stdenv.cc.cc.lib
            ];

            unpackPhase = ''
              unzip $src
            '';

            installPhase = ''
              mkdir -p $out/bin
              cp bun-linux-x64-baseline/bun $out/bin/bun
              cp bun-linux-x64-baseline/bunx $out/bin/bunx
              chmod +x $out/bin/bun
              chmod +x $out/bin/bunx
            '';
          }
        else
          pkgs.bun;
        
        ldLibraryPath = ''
          LD_LIBRARY_PATH=${pkgs.lib.makeLibraryPath [
            pkgs.stdenv.cc.cc.lib
          ]}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
        '';

        backlog-md = bun2nix.lib.${system}.mkBunDerivation {
          pname = "backlog-md";
          inherit version;
          src = ./.;
          packageJson = ./package.json;
          bunNix = ./bun.nix;

          nativeBuildInputs = [ bunPackage pkgs.git pkgs.rsync ];
          
          preBuild = ''
            export HOME=$TMPDIR
            export HUSKY=0
            export ${ldLibraryPath}
          '';
          
          buildPhase = ''
            runHook preBuild

            # Build CSS using the baseline Bun binary on x64 Linux
            ${bunPackage}/bin/bun run build:css

            # Build the CLI tool with embedded version
            ${bunPackage}/bin/bun build --compile --minify --define "__EMBEDDED_VERSION__=${version}" --outfile=dist/backlog src/cli.ts

            runHook postBuild
          '';
          
          installPhase = ''
            runHook preInstall
            
            mkdir -p $out/bin
            cp dist/backlog $out/bin/backlog
            chmod +x $out/bin/backlog
            
            runHook postInstall
          '';
          
          meta = with pkgs.lib; {
            description = "A markdown-based task management CLI tool with Kanban board";
            longDescription = ''
              Backlog.md is a command-line tool for managing tasks and projects using markdown files.
              It provides Kanban board visualization, task management, and integrates with Git workflows.
            '';
            homepage = "https://backlog.md";
            changelog = "https://github.com/MrLesk/Backlog.md/releases";
            license = licenses.mit;
            maintainers = let
              mrlesk = {
                name = "MrLesk";
                github = "MrLesk";
                githubId = 181345848;
              };
            in
              with maintainers; [ anpryl mrlesk ];
            platforms = platforms.all;
            mainProgram = "backlog";
          };
        };
      in
      {
        packages = {
          default = backlog-md;
          "backlog-md" = backlog-md;
        };
        
        apps = {
          default = flake-utils.lib.mkApp {
            drv = backlog-md;
            name = "backlog";
          };
        };
        
        devShells.default = pkgs.mkShell {
          packages = [
            bunPackage
            bun2nix.packages.${system}.default
          ];

          buildInputs = with pkgs; [
            bunPackage
            nodejs_20
            git
            biome
          ];
          
          shellHook = ''
            export ${ldLibraryPath}

            echo "Backlog.md development environment"
            echo "Available commands:"
            echo "  bun i          - Install dependencies"
            echo "  bun test       - Run tests"
            echo "  bun run cli    - Run CLI in development mode"
            echo "  bun run build  - Build the CLI tool"
            echo "  bun run check  - Run Biome checks"
          '';
        };
      });
}