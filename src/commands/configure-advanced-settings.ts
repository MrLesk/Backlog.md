import type { Core } from "../core/backlog.ts";
import type { BacklogConfig } from "../types/index.ts";
import { type PromptRunner, runAdvancedConfigWizard } from "./advanced-config-wizard.ts";

interface ConfigureAdvancedOptions {
	promptImpl?: PromptRunner;
	cancelMessage?: string;
}

export async function configureAdvancedSettings(
	core: Core,
	{ promptImpl, cancelMessage = "Aborting configuration." }: ConfigureAdvancedOptions = {},
): Promise<{ mergedConfig: BacklogConfig; installClaudeAgent: boolean }> {
	const existingConfig = await core.filesystem.loadConfig();
	if (!existingConfig) {
		throw new Error("No backlog project found. Initialize one first with: backlog init");
	}

	const wizardResult = await runAdvancedConfigWizard({
		existingConfig,
		cancelMessage,
		includeClaudePrompt: true,
		promptImpl,
	});

	const mergedConfig: BacklogConfig = { ...existingConfig, ...wizardResult.config };
	await core.filesystem.saveConfig(mergedConfig);

	return { mergedConfig, installClaudeAgent: wizardResult.installClaudeAgent };
}
