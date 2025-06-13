<h1 align="center">Backlog.md</h1>
<p align="center">✏️ Markdown‑native Task Manager &amp; Kanban visualizer for any Git repository</p>

<p align="center">
  <a href="https://www.npmjs.com/package/backlog.md">
    <img src="https://badgen.net/npm/v/backlog.md?icon=npm&label=npm">
  </a>
  <a href="https://bun.sh">
    <img src="https://badgen.net/badge/bun/add%20backlog.md/black?icon=bun">
  </a>
  <a href="LICENSE"><img src="https://badgen.net/github/license/your-org/backlog.md"></a>
</p>

---

> **Backlog.md** turns any folder with a Git repo into a **self‑contained project board**  
> powered by plain Markdown files and a zero‑config CLI.

* 100 % offline‑friendly – your backlog lives *inside* your repository  
* Works on **macOS, Linux and Windows** (Node ≥ 18 / Bun ≥ 1.0)  
* Completely free & open‑source (MIT)

---

### Quick install

```bash
# global – Node
npm i -g backlog.md

# global – Bun
bun add -g backlog.md
```

> Prefer per‑project installs? `npm i -D backlog.md` → `npx backlog …`

---

### Five‑minute tour

```bash
# 1. Bootstrap a repo + backlog
backlog init hello-world

# 2. Capture work
backlog task create "Render markdown as kanban"

# 3. See where you stand
backlog board view
```

All data is saved under `.backlog` folder as human‑readable Markdown (`task‑12 - Fix typo.md`).

---

## CLI reference (essentials)

| Action      | Example                                              |
|-------------|------------------------------------------------------|
| Create task | `backlog task create "Add OAuth"`                    |
| List tasks  | `backlog task list [-s <status>] [-a <assignee>]`     |
| View detail | `backlog task 7`                                     |
| Edit        | `backlog task edit 7 -a @sara -l auth,backend`       |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Kanban      | `backlog board export --output README.md`            |

Full help: `backlog --help` or see [`/docs`](./docs).

---

## Configuration

Backlog.md merges the following layers (highest → lowest):

1. CLI flags  
2. `.backlog/config.yml` (per‑project)  
3. `~/.backlog/user` (per‑user)  
4. Built‑ins  

Key options:

| Key               | Purpose            | Default                       |
|-------------------|--------------------|-------------------------------|
| `default_assignee`| Pre‑fill assignee  | `[]`                          |
| `default_status`  | First column       | `To Do`                       |
| `statuses`        | Board columns      | `[To Do, In Progress, Done]`  |
| `date_format`     | ISO or locale      | `yyyy-mm-dd`                  |

---


## License

Backlog.md is released under the **MIT License** – do anything, just give credit. See [LICENSE](LICENSE).