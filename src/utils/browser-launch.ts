import { $ } from "bun";

export function resolveBrowserLaunchCommand(
	url: string,
	environment: Readonly<Record<string, string | undefined>> = process.env,
	platform = process.platform,
): string[] {
	const browserExecutable = environment.BROWSER?.trim().replace(/^(['"])(.*)\1$/, "$2");
	if (browserExecutable) {
		// BROWSER is treated as one executable path. Do not split or evaluate it as
		// shell input: that would break paths with spaces and permit shell injection.
		return [browserExecutable, url];
	}

	switch (platform) {
		case "darwin":
			return ["open", url];
		case "win32":
			return ["cmd", "/c", "start", "", url];
		default:
			return ["xdg-open", url];
	}
}

export async function launchBrowser(url: string): Promise<void> {
	const command = resolveBrowserLaunchCommand(url);
	await $`${command}`.quiet();
}
