import { execSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { basename, dirname, resolve } from "path"
import { parse as parseYaml } from "yaml"
import { parse as parseShell } from "shell-quote"

export interface GuardConfig {
	dirs: string[]
	configSource: string
}

export interface GuardInput {
	tool: string
	filePath?: string
	command?: string
	grepPath?: string
	grepPattern?: string
}

export interface GuardResult {
	blocked: boolean
	blockedPath?: string
	matchedDir?: string
	kind?: string
	taskId?: string
	errorMessage?: string
}

type SuggestionKind = "task" | "doc" | "decision" | "milestone" | "config" | "other"

const READ_CMDS = new Set(["cat", "head", "tail", "less", "more", "bat"])
const GREP_CMDS = new Set(["grep", "egrep", "fgrep"])
const OPTS_WITH_VALUE = new Set([
	"-e", "-f", "-m", "-A", "-B", "-C", "-d",
	"--include", "--exclude", "--include-from", "--exclude-from",
])

let _configCache: GuardConfig | null | undefined = undefined

function resolveDirs(root: string, raw: string): GuardConfig {
	const data = parseYaml(raw) as { dirs?: string[] } | null
	const dirs = (data?.dirs ?? []).map((d: string) => resolve(root, d.trim()))
	return { dirs, configSource: resolve(root, ".backlog-guard") }
}

export function loadConfig(cwd: string): GuardConfig | null {
	if (_configCache !== undefined) return _configCache

	let p = cwd
	for (let i = 0; i < 4; i++) {
		const candidate = resolve(p, ".backlog-guard")
		if (existsSync(candidate)) {
			const raw = readFileSync(candidate, "utf8")
			_configCache = resolveDirs(dirname(candidate), raw)
			return _configCache
		}
		const parent = dirname(p)
		if (parent === p) break
		p = parent
	}

	p = cwd
	for (let i = 0; i < 4; i++) {
		if (existsSync(resolve(p, "backlog", "config.yml"))) {
			_configCache = { dirs: [resolve(p, "backlog")], configSource: "auto-detected" }
			return _configCache
		}
		const parent = dirname(p)
		if (parent === p) break
		p = parent
	}

	_configCache = null
	return null
}

export function clearConfigCache(): void {
	_configCache = undefined
}

export function loadConfigWithGitRoot(cwd: string): GuardConfig | null {
	if (_configCache !== undefined) return _configCache

	try {
		const gitRoot = execSync("git rev-parse --show-toplevel", {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim()
		const candidate = resolve(gitRoot, ".backlog-guard")
		if (existsSync(candidate)) {
			const raw = readFileSync(candidate, "utf8")
			_configCache = resolveDirs(gitRoot, raw)
			return _configCache
		}
	} catch {}

	return loadConfig(cwd)
}

export function isProtected(filePath: string, protectedDirs: string[]): string | null {
	if (!filePath) return null
	const abs = resolve(filePath)
	for (const d of protectedDirs) {
		if (abs === d || abs.startsWith(d + "/")) return d
	}
	return null
}

export function extractTaskId(pathStr: string): string | null {
	const m = basename(pathStr).match(/back-(\d+)/i)
	return m ? `BACK-${m[1]}` : null
}

export function classifyPath(pathStr: string): SuggestionKind {
	const parts = pathStr.split("/")
	for (const part of parts) {
		if (part === "tasks" || part === "completed" || part === "drafts") return "task"
		if (part === "docs") return "doc"
		if (part === "decisions") return "decision"
		if (part === "milestones") return "milestone"
	}
	if (basename(pathStr).includes("config")) return "config"
	return "other"
}

interface ShellToken {
	comment?: string
	op?: string
	pattern?: string
	glob?: string
}

export function bashTargetsProtected(
	firstSegment: string,
	protectedDirs: string[],
): string | null {
	const tokens = (parseShell(firstSegment) as (string | ShellToken)[]).filter(Boolean)
	if (tokens.length === 0) return null

	const first = tokens[0]
	if (typeof first !== "string") return null
	const cmdName = basename(first.replace(/^[&;\s]+/, ""))

	if (READ_CMDS.has(cmdName)) {
		for (let i = 1; i < tokens.length; i++) {
			const t = tokens[i]
			if (typeof t !== "string") continue
			if (!t.startsWith("-") && isProtected(t, protectedDirs)) return t
		}
	} else if (GREP_CMDS.has(cmdName)) {
		const positional: string[] = []
		let i = 1
		while (i < tokens.length) {
			const t = tokens[i]
			if (typeof t !== "string") {
				i++
				continue
			}
			if (t.startsWith("-") && OPTS_WITH_VALUE.has(t)) {
				i += 2
				continue
			}
			if (!t.startsWith("-")) positional.push(t)
			i++
		}
		for (const farg of positional.slice(1)) {
			if (isProtected(farg, protectedDirs)) return farg
		}
	} else if (cmdName === "find") {
		for (let i = 1; i < tokens.length; i++) {
			const t = tokens[i]
			if (typeof t !== "string") continue
			if (t.startsWith("-")) break
			if (isProtected(t, protectedDirs)) return t
		}
	}
	return null
}

function oc(tool: string): string {
	return `backlog_${tool}`
}

function cc(tool: string): string {
	return `mcp__backlog__${tool}`
}

function both(tool: string): string {
	return `${cc(tool)}  /  ${oc(tool)}`
}

function taskSuggestions(op: string, tid: string | null): string {
	const id = tid || "BACK-NNN"
	if (op === "read" || op === "Read") {
		return `${both("task_view")}(id="${id}")\nCLI:  backlog task ${id}`
	}
	if ((op === "write" || op === "Write") && !tid) {
		return `${both("task_create")}(title="...", description="...")\nCLI:  backlog task create "Title" -d "..."`
	}
	return `${both("task_edit")}(id="${id}", plan="...", notes="...")\nCLI:  backlog task edit ${id} --plan "..." --append-notes "..."`
}

function docSuggestions(op: string, blockedPath: string): string {
	const name = basename(blockedPath)
	if (op === "read" || op === "Read") {
		return `${both("document_view")}(path="${name}")\nCLI:  backlog doc ${name}`
	}
	if ((op === "write" || op === "Write") && !existsSync(blockedPath)) {
		return `${both("document_create")}(title="...", content="...")\nCLI:  backlog doc create "Title"`
	}
	return `${both("document_update")}(path="${name}", content="...")\nCLI:  backlog doc update ${name}`
}

function genericSuggestions(kind: string): string {
	if (kind === "milestone") {
		return `${both("milestone_list")}()\nCLI:  backlog milestones`
	}
	if (kind === "config") return "CLI:  backlog config list\nCLI:  backlog config get <key>"
	if (kind === "decision") {
		return [
			`${both("task_search")}(query="<keyword>")`,
			`  or  ${both("document_view")}(path="<name>")`,
			'CLI:  backlog search "<keyword>"',
		].join("\n")
	}
	return [
		`${both("task_list")}()  or  ${both("task_search")}(query="...")`,
		'CLI:  backlog task list  or  backlog search "..."',
	].join("\n")
}

function grepSuggestions(pattern: string, kind: string): string {
	if (kind === "doc") {
		return `${both("document_search")}(query="${pattern}")\nCLI:  backlog search "${pattern}"`
	}
	if (kind === "task" || kind === "other") {
		return `${both("task_search")}(query="${pattern}")\nCLI:  backlog search "${pattern}"`
	}
	return [
		`${both("task_search")}(query="${pattern}")`,
		`  or  ${both("document_search")}(query="${pattern}")`,
		`CLI:  backlog search "${pattern}"`,
	].join("\n")
}

function buildErrorMessage(
	tool: string,
	kind: SuggestionKind,
	taskId: string | null,
	blockedPath: string,
	matchedDir: string | null,
	configSource: string,
	grepPattern?: string,
): string {
	let header: string
	if (tool === "Grep" || tool === "grep") {
		header = "BACKLOG GUARD -- Grep on backlog directory is forbidden."
	} else if (taskId) {
		header = `BACKLOG GUARD -- ${tool} on task file (${taskId}) is forbidden.`
	} else {
		header = `BACKLOG GUARD -- ${tool} on backlog directory is forbidden.`
	}

	const op = tool === "Bash" || tool === "bash" ? "read" : tool
	let suggestion: string
	if (tool === "Grep" || tool === "grep") {
		suggestion = grepSuggestions(grepPattern || "...", kind)
	} else if (kind === "task") {
		suggestion = taskSuggestions(op, taskId)
	} else if (kind === "doc") {
		suggestion = docSuggestions(op, blockedPath)
	} else {
		suggestion = genericSuggestions(kind)
	}

	const matchedStr = matchedDir || "unknown"
	return [
		`⛔ ${header}`,
		"All backlog data access must go through MCP tools or the backlog CLI.",
		`Target: ${blockedPath}`,
		"",
		"USE ONE OF THESE INSTEAD:",
		suggestion,
		"",
		`Protected directory: ${matchedStr}`,
		`Config: ${configSource}`,
	].join("\n")
}

export function evaluate(input: GuardInput, config: GuardConfig): GuardResult {
	const { tool, filePath, command, grepPath, grepPattern } = input
	let blockedPath: string | null = null
	let matchedDir: string | null = null
	let actualGrepPattern = grepPattern

	const toolLower = tool.toLowerCase()

	if (toolLower === "read" || toolLower === "edit" || toolLower === "write") {
		const fp = filePath || ""
		matchedDir = isProtected(fp, config.dirs)
		if (matchedDir) blockedPath = fp
	} else if (toolLower === "grep") {
		const p = grepPath || ""
		matchedDir = isProtected(p, config.dirs)
		if (matchedDir) {
			blockedPath = p
			actualGrepPattern = actualGrepPattern || "..."
		}
	} else if (toolLower === "bash") {
	const cmd = command || ""
	const firstSeg = cmd.split("|")[0] || ""
		const hit = bashTargetsProtected(firstSeg, config.dirs)
		if (hit) {
			blockedPath = hit
			matchedDir = isProtected(hit, config.dirs)
		}
	}

	if (!blockedPath) return { blocked: false }

	const kind = classifyPath(blockedPath)
	const taskId = kind === "task" ? extractTaskId(blockedPath) : null
	const errorMessage = buildErrorMessage(
		tool,
		kind,
		taskId,
		blockedPath,
		matchedDir,
		config.configSource,
		actualGrepPattern,
	)

	return {
		blocked: true,
		blockedPath,
		matchedDir: matchedDir || undefined,
		kind,
		taskId: taskId || undefined,
		errorMessage,
	}
}

export function createGuardEntry(
	input: GuardInput,
	cwd: string,
): GuardResult {
	const config = loadConfigWithGitRoot(cwd)
	if (!config) return { blocked: false }
	return evaluate(input, config)
}
