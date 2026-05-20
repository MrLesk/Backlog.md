import { describe, test, expect, beforeEach } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
	clearConfigCache,
	loadConfig,
	isProtected,
	extractTaskId,
	classifyPath,
	bashTargetsProtected,
	evaluate,
	type GuardConfig,
} from "./guard-core"

let tmpDir: string
let guardConfig: GuardConfig

beforeEach(() => {
	clearConfigCache()
	tmpDir = mkdtempSync(join(tmpdir(), "backlog-guard-test-"))

	const backlog = join(tmpDir, "backlog")
	mkdirSync(join(backlog, "tasks"), { recursive: true })
	mkdirSync(join(backlog, "docs"))
	writeFileSync(join(backlog, "config.yml"), "project: test\n")
	writeFileSync(join(tmpDir, ".backlog-guard"), "dirs:\n  - backlog/\n")

	guardConfig = {
		dirs: [join(tmpDir, "backlog")],
		configSource: join(tmpDir, ".backlog-guard"),
	}
})

function mkTaskFile(name: string): string {
	const p = join(tmpDir, "backlog", "tasks", name)
	writeFileSync(p, "# Task\n")
	return p
}

function mkDocFile(name: string): string {
	const p = join(tmpDir, "backlog", "docs", name)
	writeFileSync(p, "# Doc\n")
	return p
}

// -- Config discovery ---------------------------------------------------------

describe("loadConfig", () => {
	test("finds .backlog-guard from cwd", () => {
		const cfg = loadConfig(tmpDir)
		expect(cfg).not.toBeNull()
		expect(cfg!.dirs).toHaveLength(1)
		expect(cfg!.dirs[0]).toBe(join(tmpDir, "backlog"))
	})

	test("auto-detects via backlog/config.yml", () => {
		clearConfigCache()
		rmSync(join(tmpDir, ".backlog-guard"))

		const cfg = loadConfig(tmpDir)
		expect(cfg).not.toBeNull()
		expect(cfg!.dirs).toHaveLength(1)
		expect(cfg!.configSource).toBe("auto-detected")
	})

	test("returns null for non-backlog project", () => {
		clearConfigCache()
		rmSync(join(tmpDir, ".backlog-guard"))
		rmSync(join(tmpDir, "backlog", "config.yml"))

		const cfg = loadConfig(tmpDir)
		expect(cfg).toBeNull()
	})
})

// -- Path protection ----------------------------------------------------------

describe("isProtected", () => {
	test("matches file inside protected dir", () => {
		const p = mkTaskFile("back-123 - Test.md")
		expect(isProtected(p, guardConfig.dirs)).toBe(join(tmpDir, "backlog"))
	})

	test("returns null for file outside protected dir", () => {
		const src = join(tmpDir, "src", "main.ts")
		mkdirSync(join(tmpDir, "src"), { recursive: true })
		writeFileSync(src, "const x = 1;\n")
		expect(isProtected(src, guardConfig.dirs)).toBeNull()
	})
})

// -- Task ID extraction -------------------------------------------------------

describe("extractTaskId", () => {
	test("extracts BACK-123 from filename", () => {
		expect(extractTaskId("back-123 - Feature.md")).toBe("BACK-123")
	})

	test("case insensitive", () => {
		expect(extractTaskId("BACK-456 - urgent.md")).toBe("BACK-456")
	})

	test("returns null when no ID", () => {
		expect(extractTaskId("readme.md")).toBeNull()
	})
})

// -- Path classification ------------------------------------------------------

describe("classifyPath", () => {
	test("task path", () => {
		expect(classifyPath(join("backlog", "tasks", "back-1.md"))).toBe("task")
	})

	test("doc path", () => {
		expect(classifyPath(join("backlog", "docs", "arch.md"))).toBe("doc")
	})

	test("decision path", () => {
		expect(classifyPath(join("backlog", "decisions", "adr-001.md"))).toBe("decision")
	})

	test("milestone path", () => {
		expect(classifyPath(join("backlog", "milestones", "m-1.md"))).toBe("milestone")
	})

	test("config path", () => {
		expect(classifyPath(join("backlog", "config.yml"))).toBe("config")
	})
})

// -- Bash analysis ------------------------------------------------------------

describe("bashTargetsProtected", () => {
	test("blocks cat on task file", () => {
		const p = mkTaskFile("back-123-title.md")
		expect(bashTargetsProtected(`cat ${p}`, guardConfig.dirs)).toBe(p)
	})

	test("blocks grep on task directory", () => {
		const tasksDir = join(tmpDir, "backlog", "tasks")
		expect(bashTargetsProtected(`grep -r "status" ${tasksDir}`, guardConfig.dirs)).toBe(tasksDir)
	})

	test("does not block pipeline grep", () => {
		const name = "back-123-title.md"
		expect(bashTargetsProtected(`cat something.txt | grep ${name}`, guardConfig.dirs)).toBeNull()
	})

	test("blocks find on backlog directory", () => {
		const backlog = join(tmpDir, "backlog")
		expect(bashTargetsProtected(`find ${backlog} -name "*.md"`, guardConfig.dirs)).toBe(backlog)
	})
})

// -- evaluate() end-to-end ----------------------------------------------------

describe("evaluate", () => {
	test("Read on task file is blocked with BACK-123 in message", () => {
		const p = mkTaskFile("back-123-my-feature.md")
		const result = evaluate({ tool: "Read", filePath: p }, guardConfig)
		expect(result.blocked).toBe(true)
		expect(result.errorMessage).toContain("BACK-123")
		expect(result.errorMessage).toContain("mcp__backlog__task_view")
		expect(result.errorMessage).toContain("backlog_task_view")
	})

	test("Read on src/ outside backlog is allowed", () => {
		const src = join(tmpDir, "src", "main.ts")
		mkdirSync(join(tmpDir, "src"), { recursive: true })
		writeFileSync(src, "const x = 1;\n")
		const result = evaluate({ tool: "Read", filePath: src }, guardConfig)
		expect(result.blocked).toBe(false)
	})

	test("Bash cat on task file is blocked", () => {
		const p = mkTaskFile("back-123-title.md")
		const result = evaluate({ tool: "Bash", command: `cat ${p}` }, guardConfig)
		expect(result.blocked).toBe(true)
	})

	test("Edit on doc file suggests document_update", () => {
		const p = mkDocFile("architecture.md")
		const result = evaluate({ tool: "Edit", filePath: p }, guardConfig)
		expect(result.blocked).toBe(true)
		expect(result.errorMessage).toContain("mcp__backlog__document_update")
		expect(result.errorMessage).toContain("backlog_document_update")
		expect(result.errorMessage).toContain('path="architecture.md"')
	})

	test("Write to new file suggests task_create", () => {
		const p = join(tmpDir, "backlog", "tasks", "new-task-draft.md")
		const result = evaluate({ tool: "Write", filePath: p }, guardConfig)
		expect(result.blocked).toBe(true)
		expect(result.errorMessage).toContain("mcp__backlog__task_create")
		expect(result.errorMessage).toContain("backlog_task_create")
	})

	test("Grep on tasks directory is blocked with task_search suggestion", () => {
		const tasksDir = join(tmpDir, "backlog", "tasks")
		const result = evaluate(
			{ tool: "Grep", grepPath: tasksDir, grepPattern: "status" },
			guardConfig,
		)
		expect(result.blocked).toBe(true)
		expect(result.errorMessage).toContain("mcp__backlog__task_search")
	})

	test("Grep outside backlog is allowed", () => {
		const src = join(tmpDir, "src")
		mkdirSync(src, { recursive: true })
		const result = evaluate(
			{ tool: "Grep", grepPath: src, grepPattern: "status" },
			guardConfig,
		)
		expect(result.blocked).toBe(false)
	})

	test("Read on decision file is blocked with search suggestion", () => {
		const decisions = join(tmpDir, "backlog", "decisions")
		mkdirSync(decisions)
		const adr = join(decisions, "adr-001-use-markdown.md")
		writeFileSync(adr, "# ADR 001\n")
		const result = evaluate({ tool: "Read", filePath: adr }, guardConfig)
		expect(result.blocked).toBe(true)
		expect(result.errorMessage).toContain("backlog search")
	})
})

describe("createGuardEntry (loadConfig + evaluate)", () => {
	test("no backlog project exits cleanly", async () => {
		clearConfigCache()
		const noBacklogDir = mkdtempSync(join(tmpdir(), "no-backlog-"))
		const { createGuardEntry } = await import("./guard-core")
		const result = createGuardEntry(
			{ tool: "Read", filePath: "/some/file.md" },
			noBacklogDir,
		)
		expect(result.blocked).toBe(false)
	})
})
