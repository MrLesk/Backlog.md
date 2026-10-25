import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import CleanupModal from "../web/components/CleanupModal";
import { apiClient } from "../web/lib/api";

let dom: JSDOM;
let root: Root | undefined;
const originalGlobals = {
	window: globalThis.window,
	document: globalThis.document,
	navigator: globalThis.navigator,
};

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
};
const preview = (id: string) => ({ count: 1, tasks: [{ id, title: id, createdDate: "2025-01-01" }] });
type Preview = ReturnType<typeof preview>;
const onClose = mock(() => {});
const onSuccess = mock(() => {});

const render = async (isOpen = true) => {
	await act(async () => {
		root?.render(<CleanupModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} />);
	});
};
const mount = async () => {
	dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document;
	globalThis.navigator = dom.window.navigator;
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	root = createRoot(document.getElementById("root") as HTMLElement);
	await render();
};
const button = (label: string) =>
	Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === label);
const click = async (label: string) => {
	const target = button(label);
	expect(target).toBeDefined();
	await act(async () => target?.click());
};
const finish = async (request: ReturnType<typeof deferred<Preview>>, id: string) => {
	await act(async () => request.resolve(preview(id)));
};

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	dom?.window.close();
	Object.assign(globalThis, originalGlobals);
	mock.restore();
	onClose.mockClear();
	onSuccess.mockClear();
});

describe("cleanup selection", () => {
	it("clears confirmation immediately when the age changes and submits only the new preview", async () => {
		const next = deferred<Preview>();
		spyOn(apiClient, "getCleanupPreview").mockResolvedValueOnce(preview("TASK-1")).mockReturnValueOnce(next.promise);
		const execute = spyOn(apiClient, "executeCleanup").mockResolvedValue({
			success: true,
			movedCount: 1,
			totalCount: 1,
			message: "Archived",
		});
		await mount();
		await click("1 day");
		await click("Continue");
		await click("1 month");
		expect(document.body.textContent).not.toContain("Confirm Cleanup");
		expect(button("Archive 1 Task")).toBeUndefined();
		expect(execute).not.toHaveBeenCalled();
		await finish(next, "TASK-2");
		await click("Continue");
		await click("Archive 1 Task");
		expect(execute).toHaveBeenCalledWith(["TASK-2"]);
	});

	it("keeps the latest preview when requests finish out of order", async () => {
		const first = deferred<Preview>();
		const latest = deferred<Preview>();
		spyOn(apiClient, "getCleanupPreview").mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
		await mount();
		await click("1 day");
		expect(button("1 month")?.disabled).toBe(false);
		await click("1 month");
		await finish(latest, "TASK-2");
		await finish(first, "TASK-1");
		expect(document.body.textContent).toContain("TASK-2");
		expect(document.body.textContent).not.toContain("TASK-1");
	});

	it("ignores responses and errors from a closed dialog, including external close", async () => {
		const first = deferred<Preview>();
		const second = deferred<Preview>();
		spyOn(apiClient, "getCleanupPreview").mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		await mount();
		await click("1 day");
		await click("Cancel");
		await render(false);
		await render(true);
		await click("1 month");
		await render(false);
		await render(true);
		await finish(first, "TASK-1");
		await act(async () => second.reject(new Error("Old request failed")));
		expect(document.body.textContent).not.toContain("TASK-1");
		expect(document.body.textContent).not.toContain("Old request failed");
		expect(button("Continue")).toBeUndefined();
	});

	it("prevents duplicate execution and keeps a failed selection available for retry", async () => {
		spyOn(apiClient, "getCleanupPreview").mockResolvedValue(preview("TASK-1"));
		const pending = deferred<Awaited<ReturnType<typeof apiClient.executeCleanup>>>();
		const execute = spyOn(apiClient, "executeCleanup").mockReturnValue(pending.promise);
		await mount();
		await click("1 day");
		await click("Continue");
		await act(async () => {
			const archive = button("Archive 1 Task");
			archive?.click();
			archive?.click();
		});
		expect(execute).toHaveBeenCalledTimes(1);
		await act(async () => pending.reject(new Error("Archive failed")));
		expect(document.body.textContent).toContain("Archive failed");
		expect(button("Archive 1 Task")?.disabled).toBe(false);
		expect(onSuccess).not.toHaveBeenCalled();
	});
});
