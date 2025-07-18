{
  description = "Backlog.md - A markdown-based task management CLI tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Read version from package.json
        packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        version = packageJson.version;
        
        backlog-md = pkgs.stdenv.mkDerivation rec {
          pname = "backlog.md";
          inherit version;
          
          src = ./.;
          
          nativeBuildInputs = with pkgs; [
            bun
            nodejs_20
            git
          ];
          
          buildPhase = ''
            runHook preBuild
            
            # Install dependencies
            bun install --frozen-lockfile
            
            # Build CSS
            bun run build:css
            
            # Build the CLI tool with embedded version
            bun build --compile --minify --define "__EMBEDDED_VERSION__=${version}" --outfile=dist/backlog src/cli.ts
            
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
          buildInputs = with pkgs; [
            bun
            nodejs_20
            git
            biome
          ];
          
          shellHook = ''
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