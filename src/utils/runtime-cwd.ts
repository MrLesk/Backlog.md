import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export const BACKLOG_CWD_ENV = "BACKLOG_CWD";

type RuntimeCwdSource = "option" | "env" | "process";

export interface RuntimeCwdResolution {
	cwd: string;
	source: RuntimeCwdSource;
	sourceLabel: string;
}

function resolveOverrideCandidate(cwdOption?: string): RuntimeCwdResolution | null {
	const fromOption = cwdOption?.trim();
	if (fromOption) {
		return {
			cwd: resolve(fromOption),
			source: "option",
			sourceLabel: "--cwd",
		};
	}

	const fromEnv = process.env[BACKLOG_CWD_ENV]?.trim();
	if (fromEnv) {
		return {
			cwd: resolve(fromEnv),
			source: "env",
			sourceLabel: BACKLOG_CWD_ENV,
		};
	}

	return null;
}

async function validateDirectory(path: string, sourceLabel: string): Promise<void> {
	try {
		const pathStat = await stat(path);
		if (!pathStat.isDirectory()) {
			throw new Error(`Invalid directory from ${sourceLabel}: ${path}`);
		}
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("Invalid directory")) {
			throw error;
		}
		throw new Error(`Invalid directory from ${sourceLabel}: ${path}`);
	}
}

export async function resolveRuntimeCwd(options?: { cwd?: string }): Promise<RuntimeCwdResolution> {
	const override = resolveOverrideCandidate(options?.cwd);
	if (!override) {
		return {
			cwd: process.cwd(),
			source: "process",
			sourceLabel: "process.cwd()",
		};
	}

	await validateDirectory(override.cwd, override.sourceLabel);
	return override;
}
