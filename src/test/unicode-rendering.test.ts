import { describe, expect, test } from "bun:test";
import { box } from "neo-neo-bblessed";
import { createScreen } from "../ui/tui.ts";

describe("Unicode rendering", () => {
	test("Chinese characters display without replacement", () => {
		const screen = createScreen({ smartCSR: false });
		const content = "测试中文";
		const b = box({ parent: screen, content });
		screen.render();
		const rendered = b.getContent().replaceAll("\u0003", "");
		expect(rendered).toBe(content);
		screen.destroy();
	});
});
