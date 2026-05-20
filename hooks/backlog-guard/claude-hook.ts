import { type GuardInput, createGuardEntry } from "./guard-core"

const tool = process.env.HOOK_TOOL || ""
const fp = process.env.HOOK_FP || ""
const cmd = process.env.HOOK_CMD || ""
let toolInput: Record<string, unknown> = {}
try {
	toolInput = JSON.parse(process.env.HOOK_INPUT || "{}")
} catch {}

const input: GuardInput = {
	tool,
	filePath: fp,
	command: cmd,
	grepPath: (toolInput.path as string) || (toolInput.grepPath as string) || "",
	grepPattern: (toolInput.pattern as string) || (toolInput.grepPattern as string) || "",
}

const result = createGuardEntry(input, process.cwd())

if (!result.blocked) {
	process.exit(0)
}

const output = {
	hookSpecificOutput: {
		hookEventName: "PreToolUse",
		permissionDecision: "deny",
		permissionDecisionReason: result.errorMessage,
	},
}

process.stdout.write(JSON.stringify(output))
