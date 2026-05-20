import { type GuardInput, loadConfigWithGitRoot, evaluate } from "./guard-core"

export const BacklogGuardPlugin = async () => {
	return {
		"tool.execute.before": async (
			input: { tool?: string },
			output: { args?: Record<string, unknown> },
		) => {
			const config = loadConfigWithGitRoot(process.cwd())
			if (!config) return

			const tool = input.tool || ""
			const args = output.args || {}

			const guardInput: GuardInput = {
				tool,
				filePath: (args.filePath as string) || (args.path as string) || "",
				command: (args.command as string) || (args.cmd as string) || "",
				grepPath: (args.path as string) || "",
				grepPattern: (args.pattern as string) || "",
			}

			const result = evaluate(guardInput, config)
			if (!result.blocked) return

			throw new Error(result.errorMessage)
		},
	}
}
