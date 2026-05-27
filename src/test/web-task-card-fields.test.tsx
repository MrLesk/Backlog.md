import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ConfigurableCardField, Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard.tsx";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
	id: "BACK-1",
	title: "Sample title",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
};

const render = (
	task: Task,
	hiddenFields?: ReadonlySet<ConfigurableCardField>,
): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<TaskCard task={task} onUpdate={() => {}} onEdit={() => {}} hiddenFields={hiddenFields} />,
		);
	});
	return container as HTMLElement;
};

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
});

describe("TaskCard — slot visibility", () => {
	it("renders id, title, and date by default for a minimal task", () => {
		const card = render(makeTask({ id: "BACK-7", title: "Hello", createdDate: "2026-01-01" }));
		expect(card.textContent).toContain("BACK-7");
		expect(card.textContent).toContain("Hello");
		// Date is rendered through formatRelativeDate; for a far-back date
		// the format includes "y ago" or "mo ago" — assert *something* date-
		// shaped is present rather than the exact string.
		expect(card.textContent ?? "").toMatch(/\d+(?:[dwmy]o?| ago| ago)/);
	});

	it("does NOT render a milestone slot when the task has no milestone", () => {
		const card = render(makeTask());
		// No milestone pill, no flag icon.
		expect(card.querySelector('[title^="Milestone:"]')).toBeNull();
	});

	it("renders the milestone slot when the task has a milestone and the field is not hidden", () => {
		const card = render(makeTask({ milestone: "v1.0" }));
		const pill = card.querySelector('[title^="Milestone:"]');
		expect(pill).not.toBeNull();
		expect(pill?.textContent).toContain("v1.0");
	});

	it("hides the milestone slot when hiddenFields includes 'milestone'", () => {
		const card = render(makeTask({ milestone: "v1.0" }), new Set(["milestone"]));
		expect(card.querySelector('[title^="Milestone:"]')).toBeNull();
		// Title still rendered (chrome is always on).
		expect(card.textContent).toContain("Sample title");
	});

	it("treats whitespace-only milestone as absent", () => {
		const card = render(makeTask({ milestone: "   " }));
		expect(card.querySelector('[title^="Milestone:"]')).toBeNull();
	});

	it("hides the task id when hiddenFields includes 'id'", () => {
		const card = render(makeTask({ id: "BACK-42" }), new Set(["id"]));
		expect(card.textContent).not.toContain("BACK-42");
		// Title still rendered.
		expect(card.textContent).toContain("Sample title");
	});

	it("hides the priority badge when hiddenFields includes 'priority' (border remains)", () => {
		const card = render(makeTask({ priority: "high" }), new Set(["priority"]));
		// Badge text is "High" — must be absent.
		expect(card.textContent).not.toContain("High");
		// Priority border accent is part of the chrome (border-l-red-500).
		// The wrapper div carries it via className; assert presence.
		const cardWrapper = card.querySelector("div.border-l-4");
		expect(cardWrapper).not.toBeNull();
	});

	it("hides labels when hiddenFields includes 'labels'", () => {
		const card = render(makeTask({ labels: ["bug", "ux"] }), new Set(["labels"]));
		expect(card.textContent).not.toContain("bug");
		expect(card.textContent).not.toContain("ux");
	});

	it("hides createdDate when hiddenFields includes 'createdDate' (assignee still anchors right)", () => {
		const card = render(
			makeTask({ assignee: ["alice"], createdDate: "2026-01-01" }),
			new Set(["createdDate"]),
		);
		expect(card.textContent).toContain("alice");
		// No relative-date string should appear in the footer.
		expect(card.textContent ?? "").not.toMatch(/today|yesterday|\d+(?:d ago|w ago|mo ago|y ago)/);
	});

	it("hides assignee when hiddenFields includes 'assignee' (date still anchors left)", () => {
		const card = render(
			makeTask({ assignee: ["alice"], createdDate: "2026-01-01" }),
			new Set(["assignee"]),
		);
		expect(card.textContent).not.toContain("alice");
	});

	it("collapses the footer entirely when both createdDate and assignee are hidden", () => {
		const card = render(
			makeTask({ assignee: ["alice"], createdDate: "2026-01-01" }),
			new Set(["createdDate", "assignee"]),
		);
		// The footer wraps inside a div with class .border-t for the divider.
		// When both slots are hidden, no such border-t footer element should exist.
		const footerDividers = Array.from(card.querySelectorAll("div.border-t"));
		// Some other parts of the card might use border-t too — but the
		// specific footer flex row uses "flex items-center justify-between".
		const footerRow = footerDividers.find(
			(node) => node.className.includes("flex") && node.className.includes("justify-between"),
		);
		expect(footerRow).toBeUndefined();
	});

	it("collapses the header entirely when both id and priority are hidden", () => {
		const card = render(
			makeTask({ id: "BACK-9", priority: "high" }),
			new Set(["id", "priority"]),
		);
		expect(card.textContent).not.toContain("BACK-9");
		expect(card.textContent).not.toContain("High");
		// Title remains.
		expect(card.textContent).toContain("Sample title");
	});

	it("keeps always-on chrome (title, branch banner, priority border) visible when EVERY configurable field is hidden", () => {
		const hiddenAll = new Set<ConfigurableCardField>([
			"id",
			"priority",
			"milestone",
			"labels",
			"createdDate",
			"assignee",
		]);
		const card = render(
			makeTask({
				id: "BACK-100",
				title: "Always shown",
				priority: "high",
				milestone: "v2",
				labels: ["bug"],
				assignee: ["bob"],
				branch: "feature/x",
			}),
			hiddenAll,
		);
		// Title (chrome): present.
		expect(card.textContent).toContain("Always shown");
		// Branch banner (chrome): present.
		expect(card.textContent).toContain("feature/x");
		// Priority border accent (chrome): present.
		expect(card.querySelector("div.border-l-4")).not.toBeNull();
		// All configurable fields absent.
		expect(card.textContent).not.toContain("BACK-100");
		expect(card.textContent).not.toContain("High");
		expect(card.querySelector('[title^="Milestone:"]')).toBeNull();
		expect(card.textContent).not.toContain("bug");
		expect(card.textContent).not.toContain("bob");
	});
});
