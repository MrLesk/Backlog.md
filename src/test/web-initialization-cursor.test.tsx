import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import InitializationScreen from "../web/components/InitializationScreen.tsx";
import { apiClient } from "../web/lib/api.ts";

const originalCheckStatus = apiClient.checkStatus.bind(apiClient);
const originalInitializeProject = apiClient.initializeProject.bind(apiClient);
let activeRoot: Root | null = null;

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement;

	apiClient.checkStatus = async () => ({ initialized: false, projectPath: "/tmp/cursor-web-init" });

	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	return container as HTMLElement;
}

async function click(element: Element): Promise<void> {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
}

async function setInputValue(input: HTMLInputElement, value: string): Promise<void> {
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
		valueSetter?.call(input, value);
		input.dispatchEvent(new window.Event("input", { bubbles: true }));
		await Promise.resolve();
	});
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
	const match = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	expect(match).toBeTruthy();
	return match as HTMLButtonElement;
}

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	apiClient.checkStatus = originalCheckStatus;
	apiClient.initializeProject = originalInitializeProject;
});

describe("Web Cursor initialization", () => {
	it("identifies Cursor under AGENTS.md and submits the shared target", async () => {
		const container = setupDom();
		let submitted: Parameters<typeof apiClient.initializeProject>[0] | undefined;
		let initialized = false;
		apiClient.initializeProject = async (options) => {
			submitted = options;
			return { success: true, projectName: options.projectName };
		};

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(<InitializationScreen onInitialized={() => (initialized = true)} />);
			await Promise.resolve();
		});

		const projectName = container.querySelector("input[placeholder='My Awesome Project']") as HTMLInputElement;
		await setInputValue(projectName, "Cursor Web Init");
		await click(button(container, "Next"));

		const cliMode = container.querySelector("input[name='integrationMode'][value='cli']") as HTMLInputElement;
		await click(cliMode);
		await click(button(container, "Next"));

		const agentsLabel = Array.from(container.querySelectorAll("label")).find((label) =>
			label.textContent?.includes("Cursor (uses AGENTS.md)"),
		);
		expect(agentsLabel?.textContent).toContain("AGENTS.md");
		const agentsCheckbox = agentsLabel?.querySelector("input[type='checkbox']") as HTMLInputElement;
		await click(agentsCheckbox);
		await click(button(container, "Next"));
		await click(button(container, "Next"));
		await click(button(container, "Initialize Project"));

		expect(submitted?.integrationMode).toBe("cli");
		expect(submitted?.agentInstructions).toEqual(["AGENTS.md"]);
		expect(initialized).toBe(true);
	});
});
