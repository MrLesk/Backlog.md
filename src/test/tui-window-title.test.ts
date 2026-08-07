import { describe, expect, it } from "bun:test";
import { createScreen, formatTuiTitle } from "../ui/tui.ts";

function hasControlCharacters(value: string): boolean {
	return Array.from(value).some((character) => {
		const code = character.codePointAt(0) ?? 0;
		return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
	});
}

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

	it("strips control characters from a crafted project name", () => {
		// The title is written as ESC ] 0 ; <title> BEL, so a BEL or ESC in backlog/config.yml
		// would otherwise end the sequence and inject escape codes into the terminal.
		const crafted = formatTuiTitle("Board", "Acme\u0007\u001b]0;pwned");
		expect(crafted).toBe("Acme]0;pwned - Board");
		expect(hasControlCharacters(crafted)).toBe(false);

		expect(formatTuiTitle("Board", "Acme\nWebsite")).toBe("AcmeWebsite - Board");
		expect(formatTuiTitle("Board", "Acme\u009bWebsite")).toBe("AcmeWebsite - Board");
		expect(formatTuiTitle("Board", "\u0007\u001b\u007f")).toBe("Backlog Board");
	});

	it("strips control characters from caller-supplied view titles", () => {
		const craftedTask = formatTuiTitle("Task TASK-1 - Fix\u0007 login\u001b]0;pwned", "Acme Website");
		expect(craftedTask).toBe("Acme Website - Task TASK-1 - Fix login]0;pwned");
		expect(hasControlCharacters(craftedTask)).toBe(false);

		const craftedSearch = formatTuiTitle("Search: \u001b]0;pwned\u0007", undefined);
		expect(craftedSearch).toBe("Backlog Search: ]0;pwned");
		expect(hasControlCharacters(craftedSearch)).toBe(false);
	});

	it("applies the title to the terminal screen", () => {
		const screen = createScreen({ smartCSR: false, title: formatTuiTitle("Board", "Acme Website") });
		try {
			expect(screen.title).toBe("Acme Website - Board");
		} finally {
			screen.destroy();
		}
	});

	it("keeps the emitted screen title free of injected escape sequences", () => {
		const screen = createScreen({ smartCSR: false, title: formatTuiTitle("Board", "Acme\u0007\u001b]0;pwned") });
		try {
			expect(screen.title).toBe("Acme]0;pwned - Board");
			expect(hasControlCharacters(String(screen.title))).toBe(false);
		} finally {
			screen.destroy();
		}
	});
});
