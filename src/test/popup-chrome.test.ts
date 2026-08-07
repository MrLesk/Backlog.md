import { describe, expect, it } from "bun:test";
import { openConfirmPopup } from "../ui/components/confirm-popup.ts";
import { createScreen } from "../ui/tui.ts";

type TestWidget = {
	options?: { label?: string };
	width?: number;
	height?: number;
	aleft?: number;
	atop?: number;
	emit?: (event: string, ...args: unknown[]) => void;
};

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const key = { name, full: name, shift: false };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

describe("popup chrome", () => {
	it("keeps a popup larger than the terminal inside the screen", async () => {
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 30, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 8, writable: true });
		try {
			// The confirm popup asks for a fixed 40x10, which does not fit a 30x8 terminal. Without
			// clamping, blessed centers it at a negative offset and its help row falls off-screen.
			const answer = openConfirmPopup({
				screen,
				title: "Archive task",
				message: "Archive TASK-1?",
			});
			await new Promise<void>((resolve) => setImmediate(resolve));
			await new Promise<void>((resolve) => setImmediate(resolve));

			const popup = (screen as unknown as { children: TestWidget[] }).children.find(
				(child) => child.options?.label === " Archive task ",
			);
			expect(popup).toBeDefined();
			expect(popup?.height).toBeLessThanOrEqual(8);
			expect(popup?.width).toBeLessThanOrEqual(30);
			expect(popup?.atop).toBeGreaterThanOrEqual(0);
			expect(popup?.aleft).toBeGreaterThanOrEqual(0);

			pressKey((screen as unknown as { focused?: TestWidget }).focused, "escape", "\x1b");
			expect(await answer).toBe(false);
		} finally {
			screen.destroy();
		}
	});
});
