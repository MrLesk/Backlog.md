import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { BacklogConfig } from "../types/index.ts";
import InitializationScreen from "../web/components/InitializationScreen.tsx";
import Settings from "../web/components/Settings.tsx";
import { apiClient } from "../web/lib/api.ts";

let root: Root | null = null;
const originalFetchConfig = apiClient.fetchConfig;
const originalFetchStatuses = apiClient.fetchStatuses;
const originalUpdateConfig = apiClient.updateConfig;
const originalCheckStatus = apiClient.checkStatus;
const originalInitializeProject = apiClient.initializeProject;

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost/settings",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	const container = document.getElementById("root");
	if (!container) throw new Error("Missing test root");
	return container;
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 30; attempt += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
	expect(predicate()).toBe(true);
}

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	apiClient.fetchConfig = originalFetchConfig;
	apiClient.fetchStatuses = originalFetchStatuses;
	apiClient.updateConfig = originalUpdateConfig;
	apiClient.checkStatus = originalCheckStatus;
	apiClient.initializeProject = originalInitializeProject;
});

describe("Settings auto commit mode", () => {
	it("browser initialization selects, summarizes, and submits the mode", async () => {
		let submitted: Parameters<typeof apiClient.initializeProject>[0] | undefined;
		apiClient.checkStatus = async () => ({ initialized: false, projectPath: "/tmp/project" });
		apiClient.initializeProject = async (options) => {
			submitted = options;
			return { success: true, projectName: options.projectName };
		};

		const container = setupDom();
		root = createRoot(container);
		await act(async () => {
			root?.render(<InitializationScreen onInitialized={() => {}} />);
		});
		await waitFor(() => container.querySelector<HTMLInputElement>('input[placeholder="My Awesome Project"]') !== null);

		const projectName = container.querySelector<HTMLInputElement>('input[placeholder="My Awesome Project"]');
		await act(async () => {
			if (!projectName) return;
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
			setter?.call(projectName, "Browser Init");
			projectName.dispatchEvent(new window.Event("input", { bubbles: true }));
		});
		const clickButton = async (text: string) => {
			const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.trim() === text);
			expect(button).toBeTruthy();
			await act(async () => {
				button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			});
		};
		await clickButton("Next");
		await waitFor(() => container.textContent?.includes("AI Integration Mode") ?? false);

		const noIntegration = container.querySelector<HTMLInputElement>('input[name="integrationMode"][value="none"]');
		await act(async () => {
			noIntegration?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});
		await clickButton("Next");
		await waitFor(() => container.textContent?.includes("Advanced Settings") ?? false);

		const labels = Array.from(container.querySelectorAll("label"));
		const customize = labels.find((label) => label.textContent?.includes("Configure advanced settings now"));
		await act(async () => {
			customize?.querySelector("input")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});
		await waitFor(() => container.textContent?.includes("Auto-commit changes") ?? false);
		const autoCommit = Array.from(container.querySelectorAll("label")).find((label) =>
			label.textContent?.includes("Auto-commit changes"),
		);
		await act(async () => {
			autoCommit?.querySelector("input")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});
		await waitFor(() => container.querySelector<HTMLSelectElement>("#init-auto-commit-mode") !== null);

		const mode = container.querySelector<HTMLSelectElement>("#init-auto-commit-mode");
		await act(async () => {
			if (!mode) return;
			mode.value = "amend-own";
			mode.dispatchEvent(new window.Event("change", { bubbles: true }));
		});
		await clickButton("Next");
		await waitFor(() => container.textContent?.includes("Ready to Initialize") ?? false);
		expect(container.textContent).toContain("Auto-commit Mode:");
		expect(container.textContent).toContain("amend-own");

		await clickButton("Initialize Project");
		await waitFor(() => submitted !== undefined);
		expect(submitted?.advancedConfig?.autoCommit).toBe(true);
		expect(submitted?.advancedConfig?.autoCommitMode).toBe("amend-own");
	});

	it("shows the selector when enabled and persists the selected mode", async () => {
		const config: BacklogConfig = {
			projectName: 'Web "quoted" settings',
			statuses: ["To Do", "Done"],
			labels: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
			autoCommit: true,
			autoCommitMode: "new",
		};
		let saved: BacklogConfig | undefined;
		apiClient.fetchConfig = async () => config;
		apiClient.fetchStatuses = async () => config.statuses;
		apiClient.updateConfig = async (next) => {
			saved = next;
			return next;
		};

		const container = setupDom();
		root = createRoot(container);
		await act(async () => {
			root?.render(<Settings />);
		});
		await waitFor(() => container.querySelector<HTMLSelectElement>("#autoCommitMode") !== null);

		const select = container.querySelector<HTMLSelectElement>("#autoCommitMode");
		expect(select?.value).toBe("new");
		await act(async () => {
			if (!select) return;
			select.value = "amend-own";
			select.dispatchEvent(new window.Event("change", { bubbles: true }));
		});
		const save = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Save Changes"),
		);
		expect(save).toBeTruthy();
		await act(async () => {
			save?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});
		await waitFor(() => saved !== undefined);

		expect(saved?.projectName).toBe('Web "quoted" settings');
		expect(saved?.autoCommitMode).toBe("amend-own");
		expect(container.textContent).toContain(
			"May replace the exact current locally-owned Backlog tip only when every safety check passes; otherwise creates a new commit.",
		);
	});
});
