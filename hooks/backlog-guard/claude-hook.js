// hooks/backlog-guard/guard-core.ts
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import { parse as parseYaml } from "yaml";
import { parse as parseShell } from "shell-quote";
var READ_CMDS = new Set(["cat", "head", "tail", "less", "more", "bat"]);
var GREP_CMDS = new Set(["grep", "egrep", "fgrep"]);
var OPTS_WITH_VALUE = new Set([
  "-e",
  "-f",
  "-m",
  "-A",
  "-B",
  "-C",
  "-d",
  "--include",
  "--exclude",
  "--include-from",
  "--exclude-from"
]);
var _configCache = undefined;
function resolveDirs(root, raw) {
  const data = parseYaml(raw);
  const dirs = (data?.dirs ?? []).map((d) => resolve(root, d.trim()));
  return { dirs, configSource: resolve(root, ".backlog-guard") };
}
function loadConfig(cwd) {
  if (_configCache !== undefined)
    return _configCache;
  let p = cwd;
  for (let i = 0;i < 4; i++) {
    const candidate = resolve(p, ".backlog-guard");
    if (existsSync(candidate)) {
      const raw = readFileSync(candidate, "utf8");
      _configCache = resolveDirs(dirname(candidate), raw);
      return _configCache;
    }
    const parent = dirname(p);
    if (parent === p)
      break;
    p = parent;
  }
  p = cwd;
  for (let i = 0;i < 4; i++) {
    if (existsSync(resolve(p, "backlog", "config.yml"))) {
      _configCache = { dirs: [resolve(p, "backlog")], configSource: "auto-detected" };
      return _configCache;
    }
    const parent = dirname(p);
    if (parent === p)
      break;
    p = parent;
  }
  _configCache = null;
  return null;
}
function loadConfigWithGitRoot(cwd) {
  if (_configCache !== undefined)
    return _configCache;
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"]
    }).toString().trim();
    const candidate = resolve(gitRoot, ".backlog-guard");
    if (existsSync(candidate)) {
      const raw = readFileSync(candidate, "utf8");
      _configCache = resolveDirs(gitRoot, raw);
      return _configCache;
    }
  } catch {}
  return loadConfig(cwd);
}
function isProtected(filePath, protectedDirs) {
  if (!filePath)
    return null;
  const abs = resolve(filePath);
  for (const d of protectedDirs) {
    if (abs === d || abs.startsWith(d + "/"))
      return d;
  }
  return null;
}
function extractTaskId(pathStr) {
  const m = basename(pathStr).match(/back-(\d+)/i);
  return m ? `BACK-${m[1]}` : null;
}
function classifyPath(pathStr) {
  const parts = pathStr.split("/");
  for (const part of parts) {
    if (part === "tasks" || part === "completed" || part === "drafts")
      return "task";
    if (part === "docs")
      return "doc";
    if (part === "decisions")
      return "decision";
    if (part === "milestones")
      return "milestone";
  }
  if (basename(pathStr).includes("config"))
    return "config";
  return "other";
}
function bashTargetsProtected(firstSegment, protectedDirs) {
  const tokens = parseShell(firstSegment).filter(Boolean);
  if (tokens.length === 0)
    return null;
  const first = tokens[0];
  if (typeof first !== "string")
    return null;
  const cmdName = basename(first.replace(/^[&;\s]+/, ""));
  if (READ_CMDS.has(cmdName)) {
    for (let i = 1;i < tokens.length; i++) {
      const t = tokens[i];
      if (typeof t !== "string")
        continue;
      if (!t.startsWith("-") && isProtected(t, protectedDirs))
        return t;
    }
  } else if (GREP_CMDS.has(cmdName)) {
    const positional = [];
    let i = 1;
    while (i < tokens.length) {
      const t = tokens[i];
      if (typeof t !== "string") {
        i++;
        continue;
      }
      if (t.startsWith("-") && OPTS_WITH_VALUE.has(t)) {
        i += 2;
        continue;
      }
      if (!t.startsWith("-"))
        positional.push(t);
      i++;
    }
    for (const farg of positional.slice(1)) {
      if (isProtected(farg, protectedDirs))
        return farg;
    }
  } else if (cmdName === "find") {
    for (let i = 1;i < tokens.length; i++) {
      const t = tokens[i];
      if (typeof t !== "string")
        continue;
      if (t.startsWith("-"))
        break;
      if (isProtected(t, protectedDirs))
        return t;
    }
  }
  return null;
}
function oc(tool) {
  return `backlog_${tool}`;
}
function cc(tool) {
  return `mcp__backlog__${tool}`;
}
function both(tool) {
  return `${cc(tool)}  /  ${oc(tool)}`;
}
function taskSuggestions(op, tid) {
  const id = tid || "BACK-NNN";
  if (op === "read" || op === "Read") {
    return `${both("task_view")}(id="${id}")
CLI:  backlog task ${id}`;
  }
  if ((op === "write" || op === "Write") && !tid) {
    return `${both("task_create")}(title="...", description="...")
CLI:  backlog task create "Title" -d "..."`;
  }
  return `${both("task_edit")}(id="${id}", plan="...", notes="...")
CLI:  backlog task edit ${id} --plan "..." --append-notes "..."`;
}
function docSuggestions(op, blockedPath) {
  const name = basename(blockedPath);
  if (op === "read" || op === "Read") {
    return `${both("document_view")}(path="${name}")
CLI:  backlog doc ${name}`;
  }
  if ((op === "write" || op === "Write") && !existsSync(blockedPath)) {
    return `${both("document_create")}(title="...", content="...")
CLI:  backlog doc create "Title"`;
  }
  return `${both("document_update")}(path="${name}", content="...")
CLI:  backlog doc update ${name}`;
}
function genericSuggestions(kind) {
  if (kind === "milestone") {
    return `${both("milestone_list")}()
CLI:  backlog milestones`;
  }
  if (kind === "config")
    return `CLI:  backlog config list
CLI:  backlog config get <key>`;
  if (kind === "decision") {
    return [
      `${both("task_search")}(query="<keyword>")`,
      `  or  ${both("document_view")}(path="<name>")`,
      'CLI:  backlog search "<keyword>"'
    ].join(`
`);
  }
  return [
    `${both("task_list")}()  or  ${both("task_search")}(query="...")`,
    'CLI:  backlog task list  or  backlog search "..."'
  ].join(`
`);
}
function grepSuggestions(pattern, kind) {
  if (kind === "doc") {
    return `${both("document_search")}(query="${pattern}")
CLI:  backlog search "${pattern}"`;
  }
  if (kind === "task" || kind === "other") {
    return `${both("task_search")}(query="${pattern}")
CLI:  backlog search "${pattern}"`;
  }
  return [
    `${both("task_search")}(query="${pattern}")`,
    `  or  ${both("document_search")}(query="${pattern}")`,
    `CLI:  backlog search "${pattern}"`
  ].join(`
`);
}
function buildErrorMessage(tool, kind, taskId, blockedPath, matchedDir, configSource, grepPattern) {
  let header;
  if (tool === "Grep" || tool === "grep") {
    header = "BACKLOG GUARD -- Grep on backlog directory is forbidden.";
  } else if (taskId) {
    header = `BACKLOG GUARD -- ${tool} on task file (${taskId}) is forbidden.`;
  } else {
    header = `BACKLOG GUARD -- ${tool} on backlog directory is forbidden.`;
  }
  const op = tool === "Bash" || tool === "bash" ? "read" : tool;
  let suggestion;
  if (tool === "Grep" || tool === "grep") {
    suggestion = grepSuggestions(grepPattern || "...", kind);
  } else if (kind === "task") {
    suggestion = taskSuggestions(op, taskId);
  } else if (kind === "doc") {
    suggestion = docSuggestions(op, blockedPath);
  } else {
    suggestion = genericSuggestions(kind);
  }
  const matchedStr = matchedDir || "unknown";
  return [
    `⛔ ${header}`,
    "All backlog data access must go through MCP tools or the backlog CLI.",
    `Target: ${blockedPath}`,
    "",
    "USE ONE OF THESE INSTEAD:",
    suggestion,
    "",
    `Protected directory: ${matchedStr}`,
    `Config: ${configSource}`
  ].join(`
`);
}
function evaluate(input, config) {
  const { tool, filePath, command, grepPath, grepPattern } = input;
  let blockedPath = null;
  let matchedDir = null;
  let actualGrepPattern = grepPattern;
  const toolLower = tool.toLowerCase();
  if (toolLower === "read" || toolLower === "edit" || toolLower === "write") {
    const fp = filePath || "";
    matchedDir = isProtected(fp, config.dirs);
    if (matchedDir)
      blockedPath = fp;
  } else if (toolLower === "grep") {
    const p = grepPath || "";
    matchedDir = isProtected(p, config.dirs);
    if (matchedDir) {
      blockedPath = p;
      actualGrepPattern = actualGrepPattern || "...";
    }
  } else if (toolLower === "bash") {
    const cmd = command || "";
    const firstSeg = cmd.split("|")[0] || "";
    const hit = bashTargetsProtected(firstSeg, config.dirs);
    if (hit) {
      blockedPath = hit;
      matchedDir = isProtected(hit, config.dirs);
    }
  }
  if (!blockedPath)
    return { blocked: false };
  const kind = classifyPath(blockedPath);
  const taskId = kind === "task" ? extractTaskId(blockedPath) : null;
  const errorMessage = buildErrorMessage(tool, kind, taskId, blockedPath, matchedDir, config.configSource, actualGrepPattern);
  return {
    blocked: true,
    blockedPath,
    matchedDir: matchedDir || undefined,
    kind,
    taskId: taskId || undefined,
    errorMessage
  };
}
function createGuardEntry(input, cwd) {
  const config = loadConfigWithGitRoot(cwd);
  if (!config)
    return { blocked: false };
  return evaluate(input, config);
}

// hooks/backlog-guard/claude-hook.ts
var tool = process.env.HOOK_TOOL || "";
var fp = process.env.HOOK_FP || "";
var cmd = process.env.HOOK_CMD || "";
var toolInput = {};
try {
  toolInput = JSON.parse(process.env.HOOK_INPUT || "{}");
} catch {}
var input = {
  tool,
  filePath: fp,
  command: cmd,
  grepPath: toolInput.path || toolInput.grepPath || "",
  grepPattern: toolInput.pattern || toolInput.grepPattern || ""
};
var result = createGuardEntry(input, process.cwd());
if (!result.blocked) {
  process.exit(0);
}
var output = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: result.errorMessage
  }
};
process.stdout.write(JSON.stringify(output));
