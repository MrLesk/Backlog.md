import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard.tsx";

const DAY_MS = 24 * 60 * 60 * 1000;

// The card renders dates relative to now, so every stored date here is derived from the clock the
// test runs on. A fixed calendar date would change its rendered text as time passes.
const storedDateDaysAgo = (days: number): string =>
	new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 16).replace("T", " ");

const createTask = (overrides: Partial<Task> = {}): Task => ({
	id: "TASK-1",
	title: "Dated task",
	status: "To Do",
	assignee: ["@alice"],
	createdDate: storedDateDaysAgo(5),
	labels: [],
	dependencies: [],
	...overrides,
});

const renderCard = (task: Task): Element => {
	const html = renderToString(<TaskCard task={task} onUpdate={() => {}} onEdit={() => {}} />);
	const card = JSDOM.fragment(html).querySelector("[role='button']");
	if (!card) throw new Error("The card did not render");
	return card;
};

/** The dates the card shows, in order. They lead the footer, which is the last row of the card. */
const getCardDates = (card: Element): string[] =>
	Array.from(card.lastElementChild?.firstElementChild?.children ?? [], (date) => date.textContent ?? "");

describe("web board card dates", () => {
	it("shows the updated date beside the created date, in the same relative style", () => {
		const card = renderCard(createTask({ updatedDate: storedDateDaysAgo(2) }));

		expect(getCardDates(card)).toEqual(["5d ago", "Updated: 2d ago"]);
	});

	it("shows only the created date for a task without an updated date", () => {
		const card = renderCard(createTask());

		expect(getCardDates(card)).toEqual(["5d ago"]);
		expect(card.textContent).not.toContain("Updated");
	});
});
