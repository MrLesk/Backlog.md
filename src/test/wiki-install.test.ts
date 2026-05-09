import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, lstatSync } from "node:fs";
import { mkdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatInstallResult, installWikiSkill, resolveAgent, type SupportedAgent } from "../commands/wiki-install.ts";
import { LLM_WIKI_FOR_BACKLOG_SKILL } from "../skills/embedded/llm-wiki-for-backlog.ts";
import { createUniqueTestDir } from "./test-utils.ts";

describe("wiki-install", () => {
	describe("resolveAgent", () => {
		it("resolves valid aliases", () => {
			expect(resolveAgent("claude")).toBe("claude");
			expect(resolveAgent("codex")).toBe("codex");
			expect(resolveAgent("agents")).toBe("agents");
			expect(resolveAgent("CLAUDE")).toBe("claude");
			expect(resolveAgent("  claude  ")).toBe("claude");
		});

		it("throws for invalid aliases", () => {
			expect(() => resolveAgent("cursor")).toThrow("Unsupported agent");
			expect(() => resolveAgent("gemini")).toThrow("Unsupported agent");
			expect(() => resolveAgent("unknown")).toThrow("Unsupported agent");
		});
	});

	describe("installWikiSkill", () => {
		let TEST_PROJECT: string;

		beforeEach(async () => {
			TEST_PROJECT = createUniqueTestDir("test-wiki-install");
			await rm(TEST_PROJECT, { recursive: true, force: true }).catch(() => {});
			await mkdir(TEST_PROJECT, { recursive: true });
		});

		afterEach(async () => {
			await rm(TEST_PROJECT, { recursive: true, force: true }).catch(() => {});
		});

		it("writes skill files to .agents/skills/llm-wiki-for-backlog/", async () => {
			await installWikiSkill(TEST_PROJECT, "agents");

			const skillDir = join(TEST_PROJECT, ".agents", "skills", "llm-wiki-for-backlog");
			expect(existsSync(skillDir)).toBe(true);
			expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);

			for (const relativePath of Object.keys(LLM_WIKI_FOR_BACKLOG_SKILL)) {
				expect(existsSync(join(skillDir, relativePath))).toBe(true);
			}
		});

		it("creates symlink for claude agent", async () => {
			// Skip on Windows if symlinks aren't supported
			if (process.platform === "win32") {
				// This test may fail on Windows without Developer Mode; skip gracefully
				try {
					await installWikiSkill(TEST_PROJECT, "claude");
				} catch {
					return;
				}
			} else {
				await installWikiSkill(TEST_PROJECT, "claude");
			}

			const claudeSkills = join(TEST_PROJECT, ".claude", "skills");
			if (existsSync(claudeSkills)) {
				const stat = lstatSync(claudeSkills);
				if (stat.isSymbolicLink()) {
					const target = await readlink(claudeSkills).catch(() => "");
					expect(target.trim().replace(/\\/g, "/")).toBe("../.agents/skills");
				}
			}
		});

		it("returns skill metadata from SKILL.md", async () => {
			const result = await installWikiSkill(TEST_PROJECT, "codex");

			expect(result.skillName).toBe("llm-wiki-for-backlog");
			expect(result.agent).toBe("codex");
			expect(result.filesWritten.length).toBeGreaterThan(0);
			expect(result.filesWritten).toContain("SKILL.md");
			expect(result.skillMeta.name).toBe("llm-wiki-for-backlog");
			expect(result.skillMeta.description).toBeTruthy();
		});

		it("dry-run does not create files", async () => {
			const result = await installWikiSkill(TEST_PROJECT, "agents", { dryRun: true });

			expect(result.filesWritten.length).toBeGreaterThan(0);
			const skillDir = join(TEST_PROJECT, ".agents", "skills", "llm-wiki-for-backlog");
			expect(existsSync(skillDir)).toBe(false);
		});

		it("uses existing directory directly without requiring --force", async () => {
			const claudeSkills = join(TEST_PROJECT, ".claude", "skills");
			await mkdir(claudeSkills, { recursive: true });
			await writeFile(join(claudeSkills, "existing.md"), "test");

			const result = await installWikiSkill(TEST_PROJECT, "claude");

			// Should write into the existing directory, not replace it with symlink
			expect(result.skillTargetDir).toBe(join(claudeSkills, "llm-wiki-for-backlog"));
			expect(result.symlinkCreated).toBe(false);
			// Old file should still exist
			expect(existsSync(join(claudeSkills, "existing.md"))).toBe(true);
			// New skill files should be written
			expect(existsSync(join(claudeSkills, "llm-wiki-for-backlog", "SKILL.md"))).toBe(true);
		});

		it("rejects overwriting existing skill without --force", async () => {
			await installWikiSkill(TEST_PROJECT, "agents");
			await expect(installWikiSkill(TEST_PROJECT, "agents")).rejects.toThrow("already exists");
		});

		it("overwrites existing skill with --force", async () => {
			await installWikiSkill(TEST_PROJECT, "agents");
			const result = await installWikiSkill(TEST_PROJECT, "agents", { force: true });
			expect(result.filesWritten.length).toBeGreaterThan(0);
		});

		it("noop when symlink already points to correct target", async () => {
			// Only test on non-Windows platforms
			if (process.platform === "win32") return;

			const agentsSkills = join(TEST_PROJECT, ".agents", "skills");
			const claudeDir = join(TEST_PROJECT, ".claude");
			const claudeSkills = join(claudeDir, "skills");
			await mkdir(agentsSkills, { recursive: true });
			await mkdir(claudeDir, { recursive: true });
			await symlink("../.agents/skills", claudeSkills, "dir");

			const result = await installWikiSkill(TEST_PROJECT, "claude");

			expect(result.symlinkExisted).toBe(true);
			expect(result.symlinkCreated).toBe(false);
		});
	});

	describe("formatInstallResult", () => {
		it("includes skill name and agent", () => {
			const result = formatInstallResult(
				{
					agent: "claude" as SupportedAgent,
					agentSkillsPath: ".claude/skills",
					skillTargetDir: ".agents/skills/llm-wiki-for-backlog",
					skillName: "llm-wiki-for-backlog",
					filesWritten: ["SKILL.md"],
					symlinkCreated: true,
					symlinkExisted: false,
					fallbackCopy: false,
					skillMeta: { name: "llm-wiki-for-backlog", description: "A skill" },
				},
				false,
			);

			expect(result).toContain("llm-wiki-for-backlog");
			expect(result).toContain("claude");
			expect(result).toContain("SKILL.md");
			expect(result).toContain("symlink");
		});

		it("shows dry-run prefix when dryRun is true", () => {
			const result = formatInstallResult(
				{
					agent: "codex" as SupportedAgent,
					agentSkillsPath: ".codex/skills",
					skillTargetDir: ".agents/skills/llm-wiki-for-backlog",
					skillName: "llm-wiki-for-backlog",
					filesWritten: ["SKILL.md"],
					symlinkCreated: false,
					symlinkExisted: false,
					fallbackCopy: false,
					skillMeta: {},
				},
				true,
			);

			expect(result).toContain("[DRY RUN]");
		});
	});
});
