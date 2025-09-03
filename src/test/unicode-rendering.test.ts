import { describe, expect, test } from "bun:test";
import blessed from "blessed";
import { createScreen } from "../ui/tui.ts";

describe("Unicode rendering", () => {
	test("Chinese characters display without replacement", () => {
		const screen = createScreen({ smartCSR: false });
		const content = "测试中文";
		const box = blessed.box({ parent: screen, content });
		screen.render();
		const rendered = box.getContent().replaceAll("\u0003", "");
		expect(rendered).toBe(content);
		screen.destroy();
	});
});
