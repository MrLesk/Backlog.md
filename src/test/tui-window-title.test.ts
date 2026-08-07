import { describe, expect, it } from "bun:test";
import { createScreen, formatTuiTitle } from "../ui/tui.ts";

describe("TUI window titles", () => {
	it("prefixes the configured project name", () => {
		expect(formatTuiTitle("Board", "Acme Website")).toBe("Acme Website - Board");
		expect(formatTuiTitle("Tasks", "Acme Website")).toBe("Acme Website - Tasks");
		expect(formatTuiTitle("Overview", "Acme Website")).toBe("Acme Website - Overview");
		expect(formatTuiTitle("Task TASK-1 - Fix login", "Acme Website")).toBe("Acme Website - Task TASK-1 - Fix login");
	});

	it("trims surrounding whitespace from the project name", () => {
		expect(formatTuiTitle("Board", "  Acme Website  ")).toBe("Acme Website - Board");
	});

	it("falls back to a generic title when the project name is unusable", () => {
		expect(formatTuiTitle("Board", undefined)).toBe("Backlog Board");
		expect(formatTuiTitle("Board", "")).toBe("Backlog Board");
		expect(formatTuiTitle("Board", "   ")).toBe("Backlog Board");
		expect(formatTuiTitle("Tasks", "Untitled Project")).toBe("Backlog Tasks");
		expect(formatTuiTitle("Overview", "untitled project")).toBe("Backlog Overview");
	});

	it("applies the title to the terminal screen", () => {
		const screen = createScreen({ smartCSR: false, title: formatTuiTitle("Board", "Acme Website") });
		try {
			expect(screen.title).toBe("Acme Website - Board");
		} finally {
			screen.destroy();
		}
	});
});
