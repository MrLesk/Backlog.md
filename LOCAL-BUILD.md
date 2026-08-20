# Local build notes

This is a fork of `MrLesk/Backlog.md`. The `backlog` command on this machine
runs a binary built from this fork, not the published npm package. Read this
before touching the install, because the way it is wired is not obvious and
nothing warns you when it breaks.

## Where the running binary lives

```
~/.bun/install/global/node_modules/backlog.md-linux-x64/backlog
```

The npm package `backlog.md` is only a launcher. Its `cli.js` calls
`resolveBinary.cjs`, which picks the platform package `backlog.md-linux-x64`
and runs the `backlog` file inside it. The fork is installed by building a
binary and overwriting that file by hand.

A rollback copy of the stock upstream binary is kept next to it as
`backlog.orig-1.49.0`.

## Two traps

**The launcher's version is stale and lies.** `package.json` in both
`backlog.md` and `backlog.md-linux-x64` still says `1.49.0`, because those
files came from the original npm install and were never touched. The binary
itself reports the real version. Trust `backlog --version`, not the package
metadata. Checked on 2026-08-20, when the metadata said 1.49.0 and the binary
correctly reported 1.49.2.

**Any reinstall silently reverts the fork.** Running `bun update`, or
installing `backlog.md` globally again, replaces the hand-placed binary with
the stock one. There is no error and no warning. The only symptom is that the
local fixes quietly stop working. After any global package operation, re-run
the verification below.

## Rebuilding and reinstalling

`bun run build` runs `scripts/build.ts` and compiles a single file executable
to `dist/backlog`. Override the path with `BACKLOG_BUILD_OUTFILE` if needed.

```bash
cd ~/Work/try-rs/Backlog.md
bun run build
D=~/.bun/install/global/node_modules/backlog.md-linux-x64
cp "$D/backlog" "$D/backlog.bak.$(date +%F)"
cp dist/backlog "$D/backlog"
backlog --version
```

Keep a dated copy of the binary you are replacing before you overwrite it.
Each one costs about 100 MB, so delete the old ones once the new build is
confirmed working. Verified on 2026-08-20 that `dist/backlog` was byte
identical to the installed binary, so this is the path that was actually
used.

If a `backlog browser` server is running, the copy fails with `Text file
busy`, because the running process holds that exact file. Do not kill the
server. Rename the old binary out of the way first, which Linux allows even
while it is running, then copy the new one into place.

```bash
mv "$D/backlog" "$D/backlog.inuse-old"
cp dist/backlog "$D/backlog"
chmod +x "$D/backlog"
rm -f "$D/backlog.inuse-old"
```

The running server keeps the old code until it is restarted, since it still
holds the original inode.

## You cannot preview the web UI from source

`bun src/cli.ts browser` starts and serves the page, but the page is blank.
The server returns the HTML and then 404s on its own JavaScript chunk at
`/backlog/chunk-*.js`. The same project directory works correctly through a
built binary, so this is a development mode asset routing problem rather than
a fault in the application. There is no watch or dev script in `package.json`
either.

To see a web UI change you have to run `bun run build` and then run
`dist/backlog browser`. Budget for it. The build takes a few minutes and
produces a 100 MB executable.

The full test suite is about six minutes, 1904 tests across 211 files. Run a
single file while working, e.g. `bun test src/test/web-board-filters.test.tsx`.
A commit also triggers husky and lint-staged, which runs biome over the staged
files and can rewrite them.

## Verifying the fork is actually live

Version alone does not prove it, since a stock build can share a version
number. Test the behavior instead. Unknown frontmatter keys must survive a
CLI write.

```bash
cd "$(mktemp -d)" && git init -q . \
  && git config user.email t@t && git config user.name t
backlog init test --agent-instructions none --check-branches false \
  --auto-open-browser false --install-claude-agent false
backlog task create "probe"
F=$(find backlog/tasks -name '*.md' | head -1)
python3 - "$F" <<'PY'
import sys
p = sys.argv[1]; t = open(p).read(); i = t.index('---', 3)
open(p, 'w').write(t[:i] + 'kanban_order: 42\n' + t[i:])
PY
backlog task edit 1 -t "probe again"
grep -q kanban_order "$(find backlog/tasks -name '*.md' | head -1)" \
  && echo "fork is live" || echo "stock binary, fixes are gone"
```

Quote the task file path. Filenames contain spaces, so an unquoted `$F` reads
as two arguments and the test silently passes over a file that was never
opened.

## What this fork changes

Four commits on `local-build`, none of them accepted upstream as of
2026-08-20.

- Keep task fields Backlog.md does not recognize instead of deleting them.
  Serialization used to rebuild the frontmatter from typed fields, so any key
  an outside tool had added was dropped on the next write. The case that
  surfaced it was an Obsidian kanban board keeping card position in
  `kanban_order`.
- Show full task titles instead of clipping them on the kanban board.
- Show full task titles instead of clipping them in the TUI task list.

The branches `local-build` and `preserve-unknown-frontmatter` are pushed to
`origin`, which is `github.com/testy-cool/Backlog.md`.
