import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThemeProvider, useTheme } from "../web/contexts/ThemeContext";

const choiceKey = "backlog-theme-choice";

let activeRoot: Root | null = null;
let osPrefersDark = false;
let osSchemeListeners: Array<(event: { matches: boolean }) => void> = [];

function setOsPrefersDark(prefersDark: boolean): void {
	osPrefersDark = prefersDark;
	act(() => {
		for (const listener of osSchemeListeners) {
			listener({ matches: prefersDark });
		}
	});
}

beforeEach(() => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.localStorage = dom.window.localStorage;
	osPrefersDark = false;
	osSchemeListeners = [];
	window.matchMedia = (() =>
		({
			get matches() {
				return osPrefersDark;
			},
			addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
				osSchemeListeners.push(listener);
			},
			removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
				osSchemeListeners = osSchemeListeners.filter((registered) => registered !== listener);
			},
		}) as unknown as MediaQueryList) as typeof window.matchMedia;
});

afterEach(() => {
	act(() => {
		activeRoot?.unmount();
	});
	activeRoot = null;
});

function ThemeProbe() {
	const { theme, toggleTheme } = useTheme();
	return (
		<button type="button" data-theme={theme} onClick={toggleTheme}>
			toggle
		</button>
	);
}

function renderTheme(): void {
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);
	});
}

function shownTheme(): string | null {
	const theme = document.querySelector("button")?.getAttribute("data-theme") ?? null;
	expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark");
	return theme;
}

function toggle(): void {
	act(() => {
		document.querySelector("button")?.click();
	});
}

describe("web theme", () => {
	it("follows the OS scheme live and stores nothing while the user has not chosen", () => {
		osPrefersDark = true;
		renderTheme();
		expect(shownTheme()).toBe("dark");

		setOsPrefersDark(false);
		expect(shownTheme()).toBe("light");
		setOsPrefersDark(true);
		expect(shownTheme()).toBe("dark");
		expect(localStorage.getItem(choiceKey)).toBeNull();
	});

	it("pins a theme the OS does not show, across OS changes and reloads", () => {
		renderTheme();
		toggle();
		expect(shownTheme()).toBe("dark");
		expect(localStorage.getItem(choiceKey)).toBe("dark");

		setOsPrefersDark(true);
		setOsPrefersDark(false);
		expect(shownTheme()).toBe("dark");

		act(() => {
			activeRoot?.unmount();
		});
		renderTheme();
		expect(shownTheme()).toBe("dark");
	});

	it("follows the OS again after toggling back to the theme the OS shows", () => {
		localStorage.setItem(choiceKey, "dark");
		renderTheme();
		toggle();
		expect(shownTheme()).toBe("light");
		expect(localStorage.getItem(choiceKey)).toBeNull();

		setOsPrefersDark(true);
		expect(shownTheme()).toBe("dark");
	});

	it("ignores a theme saved under the old key", () => {
		localStorage.setItem("backlog-theme", "dark");
		renderTheme();
		expect(shownTheme()).toBe("light");
	});
});
