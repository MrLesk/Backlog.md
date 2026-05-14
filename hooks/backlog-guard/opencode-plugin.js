/**
 * OpenCode plugin: block read/write/edit/bash on Backlog.md data directories.
 *
 * Mirrors the logic in check.py for OpenCode's tool.execute.before hook.
 * Throws an Error to deny the tool call, which OpenCode treats as a hard block.
 *
 * Config discovery (same order as check.py):
 *   1. .backlog-guard YAML at git root
 *   2. Walk CWD upward (4 levels) for .backlog-guard
 *   3. Auto-detect: walk CWD upward for backlog/config.yml
 *   4. Nothing found → no-op (not a backlog project)
 */

import { execSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { basename, dirname, join, resolve } from "path"

// -- YAML parsing (no external deps) -----------------------------------------

function parseYamlDirsList(content) {
	// Only parses the `dirs:` list we write ourselves — not a general YAML parser.
	const match = content.match(/^dirs:\s*\n((?:[ \t]+-[^\n]*\n?)*)/m)
	if (!match) return []
	return match[1]
		.split("\n")
		.map((l) => l.replace(/^[ \t]+-\s*/, "").trim())
		.filter(Boolean)
}

// -- Config discovery (cached per process) -----------------------------------

let _cache = undefined

function loadConfig(cwd) {
	if (_cache !== undefined) return _cache

	// 1. Git root
	try {
		const gitRoot = execSync("git rev-parse --show-toplevel", {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim()
		const candidate = join(gitRoot, ".backlog-guard")
		if (existsSync(candidate)) {
			const dirs = parseYamlDirsList(readFileSync(candidate, "utf8"))
			_cache = { root: gitRoot, dirs: dirs.map((d) => resolve(gitRoot, d)) }
			return _cache
		}
	} catch {}

	// 2. Walk CWD upward
	let p = cwd
	for (let i = 0; i < 4; i++) {
		const candidate = join(p, ".backlog-guard")
		if (existsSync(candidate)) {
			const dirs = parseYamlDirsList(readFileSync(candidate, "utf8"))
			_cache = { root: p, dirs: dirs.map((d) => resolve(p, d)) }
			return _cache
		}
		const parent = dirname(p)
		if (parent === p) break
		p = parent
	}

	// 3. Auto-detect fallback
	p = cwd
	for (let i = 0; i < 4; i++) {
		if (existsSync(join(p, "backlog", "config.yml"))) {
			_cache = { root: p, dirs: [resolve(p, "backlog")] }
			return _cache
		}
		const parent = dirname(p)
		if (parent === p) break
		p = parent
	}

	// 4. Not a backlog project
	_cache = null
	return null
}

// -- Path helpers -------------------------------------------------------------

function isProtected(pathStr, protectedDirs) {
	if (!pathStr) return null
	const abs = resolve(pathStr)
	for (const d of protectedDirs) {
		if (abs === d || abs.startsWith(d + "/")) return d
	}
	return null
}

function extractTaskId(pathStr) {
	const m = basename(pathStr).match(/back-(\d+)/i)
	return m ? `BACK-${m[1]}` : null
}

function classifyPath(pathStr) {
	for (const part of pathStr.split("/")) {
		if (part === "tasks" || part === "completed" || part === "drafts") return "task"
		if (part === "docs") return "doc"
		if (part === "decisions") return "decision"
		if (part === "milestones") return "milestone"
	}
	if (basename(pathStr).includes("config")) return "config"
	return "other"
}

// -- Bash analysis -----------------------------------------------------------

const READ_CMDS = new Set(["cat", "head", "tail", "less", "more", "bat"])
const GREP_CMDS = new Set(["grep", "egrep", "fgrep"])
const OPTS_WITH_VALUE = new Set([
	"-e", "-f", "-m", "-A", "-B", "-C", "-d",
	"--include", "--exclude", "--include-from", "--exclude-from",
])

function tokenize(seg) {
	// Minimal shell tokenizer: handles quoted strings and simple args.
	const tokens = []
	let cur = ""
	let inSingle = false
	let inDouble = false
	for (let i = 0; i < seg.length; i++) {
		const c = seg[i]
		if (c === "'" && !inDouble) { inSingle = !inSingle; continue }
		if (c === '"' && !inSingle) { inDouble = !inDouble; continue }
		if ((c === " " || c === "\t") && !inSingle && !inDouble) {
			if (cur) { tokens.push(cur); cur = "" }
		} else {
			cur += c
		}
	}
	if (cur) tokens.push(cur)
	return tokens
}

function bashTargetsProtected(seg, protectedDirs) {
	const tokens = tokenize(seg)
	if (!tokens.length) return null

	const cmdName = basename(tokens[0].replace(/^[&;\s]+/, ""))

	if (READ_CMDS.has(cmdName)) {
		for (const t of tokens.slice(1)) {
			if (!t.startsWith("-") && isProtected(t, protectedDirs)) return t
		}
	} else if (GREP_CMDS.has(cmdName)) {
		const positional = []
		let i = 1
		while (i < tokens.length) {
			const t = tokens[i]
			if (t.startsWith("-") && OPTS_WITH_VALUE.has(t)) { i += 2; continue }
			if (!t.startsWith("-")) positional.push(t)
			i++
		}
		for (const farg of positional.slice(1)) {
			if (isProtected(farg, protectedDirs)) return farg
		}
	} else if (cmdName === "find") {
		for (const t of tokens.slice(1)) {
			if (t.startsWith("-")) break
			if (isProtected(t, protectedDirs)) return t
		}
	}
	return null
}

// -- Stop message construction -----------------------------------------------

function taskSuggestions(op, tid) {
	const id = tid || "BACK-NNN"
	if (op === "read") return `MCP:  mcp__backlog__task_view(id="${id}")\nCLI:  backlog task ${id}`
	if (op === "write" && !tid) return `MCP:  mcp__backlog__task_create(title="...", description="...")\nCLI:  backlog task create "Title" -d "..."`
	return `MCP:  mcp__backlog__task_edit(id="${id}", plan="...", notes="...")\nCLI:  backlog task edit ${id} --plan "..." --append-notes "..."`
}

function docSuggestions(op, blockedPath) {
	const name = basename(blockedPath)
	if (op === "read") return `MCP:  mcp__backlog__document_view(path="${name}")\nCLI:  backlog doc ${name}`
	if (op === "write" && !existsSync(blockedPath)) return `MCP:  mcp__backlog__document_create(title="...", content="...")\nCLI:  backlog doc create "Title"`
	return `MCP:  mcp__backlog__document_update(path="${name}", content="...")\nCLI:  backlog doc update ${name}`
}

function genericSuggestions(kind) {
	if (kind === "milestone") return "MCP:  mcp__backlog__milestone_list()\nCLI:  backlog milestones"
	if (kind === "config") return "CLI:  backlog config list\nCLI:  backlog config get <key>"
	if (kind === "decision") return `MCP:  mcp__backlog__task_search(query="<keyword>")  or  mcp__backlog__document_view(path="<name>")\nCLI:  backlog search "<keyword>"`
	return `MCP:  mcp__backlog__task_list()  or  mcp__backlog__task_search(query="...")\nCLI:  backlog task list  or  backlog search "..."`
}

function grepSuggestions(pattern, kind) {
	if (kind === "doc") return `MCP:  mcp__backlog__document_search(query="${pattern}")\nCLI:  backlog search "${pattern}"`
	if (kind === "task" || kind === "other") return `MCP:  mcp__backlog__task_search(query="${pattern}")\nCLI:  backlog search "${pattern}"`
	return `MCP:  mcp__backlog__task_search(query="${pattern}")  or  mcp__backlog__document_search(query="${pattern}")\nCLI:  backlog search "${pattern}"`
}

function buildErrorMessage({ tool, blockedPath, matchedDir, taskId, kind, config, grepPattern }) {
	let header
	if (tool === "grep") header = "BACKLOG GUARD -- Grep on backlog directory is forbidden."
	else if (taskId) header = `BACKLOG GUARD -- ${tool} on task file (${taskId}) is forbidden.`
	else header = `BACKLOG GUARD -- ${tool} on backlog directory is forbidden.`

	const op = tool === "bash" ? "read" : tool
	let suggestion
	if (tool === "grep") suggestion = grepSuggestions(grepPattern || "...", kind)
	else if (kind === "task") suggestion = taskSuggestions(op, taskId)
	else if (kind === "doc") suggestion = docSuggestions(op, blockedPath)
	else suggestion = genericSuggestions(kind)

	return (
		`⛔ ${header}\n` +
		`All backlog data access must go through MCP tools or the backlog CLI.\n` +
		`Target: ${blockedPath}\n\n` +
		`USE ONE OF THESE INSTEAD:\n${suggestion}\n\n` +
		`Protected directory: ${matchedDir}\n` +
		`Config: ${config}`
	)
}

// -- Plugin export ------------------------------------------------------------

export default {
	"tool.execute.before": async (input) => {
		const config = loadConfig(process.cwd())
		if (!config) return

		const { tool, args } = input
		let blockedPath = null
		let matchedDir = null
		let grepPattern = null

		const toolLower = (tool || "").toLowerCase()

		if (toolLower === "read" || toolLower === "edit" || toolLower === "write") {
			const fp = args?.filePath || args?.path || ""
			matchedDir = isProtected(fp, config.dirs)
			if (matchedDir) blockedPath = fp
		} else if (toolLower === "grep") {
			const p = args?.path || ""
			matchedDir = isProtected(p, config.dirs)
			if (matchedDir) {
				blockedPath = p
				grepPattern = args?.pattern || "..."
			}
		} else if (toolLower === "bash") {
			const cmd = args?.command || args?.cmd || ""
			const firstSeg = cmd.split("|")[0]
			const hit = bashTargetsProtected(firstSeg, config.dirs)
			if (hit) {
				blockedPath = hit
				matchedDir = isProtected(hit, config.dirs)
			}
		}

		if (!blockedPath) return

		const kind = classifyPath(blockedPath)
		const taskId = kind === "task" ? extractTaskId(blockedPath) : null

		throw new Error(
			buildErrorMessage({
				tool: toolLower,
				blockedPath,
				matchedDir,
				taskId,
				kind,
				config: config.root + "/.backlog-guard",
				grepPattern,
			}),
		)
	},
}
