import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard.tsx";
import { pinTimeZone } from "./pin-timezone.ts";

const TIME_ZONE = "Asia/Tokyo";

/**
 * A moment at a local wall-clock time, a number of local calendar days before the day the test runs.
 * Every date here is derived from the clock the test runs on, so no case can age out.
 * Call it inside a test: the time zone is only pinned once the tests start.
 */
const localMoment = (daysAgo: number, hours: number, minutes: number): Date => {
	const moment = new Date();
	moment.setDate(moment.getDate() - daysAgo);
	moment.setHours(hours, minutes, 0, 0);
	return moment;
};

/** How a task file stores a moment: UTC, to the minute. */
const toStoredDate = (moment: Date): string => moment.toISOString().slice(0, 16).replace("T", " ");

/** The day a moment falls on in a time zone, written dd/mm/yyyy (which is how en-GB writes a date). */
const toDayMonthYear = (moment: Date, timeZone: string): string => moment.toLocaleDateString("en-GB", { timeZone });

const createTask = (dates: Pick<Task, "createdDate" | "updatedDate">): Task => ({
	id: "TASK-1",
	title: "Dated task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	...dates,
});

const renderCard = (task: Task, dateFormat?: string): Element => {
	const html = renderToString(<TaskCard task={task} onUpdate={() => {}} onEdit={() => {}} dateFormat={dateFormat} />);
	const card = JSDOM.fragment(html).querySelector("[role='button']");
	if (!card) throw new Error("The card did not render");
	return card;
};

/**
 * The dates the card shows, in order, each with the full value its hover reveals.
 * They lead the footer, which is the last row of the card.
 */
const getCardDates = (card: Element): { text: string; hover: string | null }[] =>
	Array.from(card.lastElementChild?.firstElementChild?.children ?? [], (date) => ({
		text: date.textContent ?? "",
		// The created date carries its own hover; the updated date's hover sits on the value after its label.
		hover: (date.querySelector("[title]") ?? date).getAttribute("title"),
	}));

describe("web board card dates", () => {
	// The card renders stored timestamps in the viewer's timezone, so pin one.
	pinTimeZone(TIME_ZONE);

	it("reads dates from the current local day as today", () => {
		const createdDate = toStoredDate(localMoment(0, 0, 0));
		const updatedDate = toStoredDate(localMoment(0, 0, 1));

		expect(getCardDates(renderCard(createTask({ createdDate, updatedDate })))).toEqual([
			{ text: "today", hover: `${createdDate} (UTC)` },
			{ text: "Updated: today", hover: `${updatedDate} (UTC)` },
		]);
	});

	it("reads dates from late last night as yesterday, by local calendar day", () => {
		// Both are less than 24 hours old for almost the whole day, so counting elapsed hours would say today.
		const createdDate = toStoredDate(localMoment(1, 23, 58));
		const updatedDate = toStoredDate(localMoment(1, 23, 59));

		expect(getCardDates(renderCard(createTask({ createdDate, updatedDate })))).toEqual([
			{ text: "yesterday", hover: `${createdDate} (UTC)` },
			{ text: "Updated: yesterday", hover: `${updatedDate} (UTC)` },
		]);
	});

	it("counts dates from the past week in local calendar days", () => {
		const createdDate = toStoredDate(localMoment(3, 23, 58));
		const updatedDate = toStoredDate(localMoment(2, 23, 59));

		expect(getCardDates(renderCard(createTask({ createdDate, updatedDate })))).toEqual([
			{ text: "3d ago", hover: `${createdDate} (UTC)` },
			{ text: "Updated: 2d ago", hover: `${updatedDate} (UTC)` },
		]);
	});

	it("shows dates older than a week as the local day in the configured date format", () => {
		// 08:00 in Tokyo is 23:00 on the previous day in UTC, so the card must show the viewer's day
		// while the hover keeps the stored one.
		const created = localMoment(30, 8, 0);
		const updated = localMoment(8, 8, 0);
		const task = createTask({ createdDate: toStoredDate(created), updatedDate: toStoredDate(updated) });

		expect(getCardDates(renderCard(task, "dd/mm/yyyy"))).toEqual([
			{ text: toDayMonthYear(created, TIME_ZONE), hover: `${toDayMonthYear(created, "UTC")} 23:00 (UTC)` },
			{
				text: `Updated: ${toDayMonthYear(updated, TIME_ZONE)}`,
				hover: `${toDayMonthYear(updated, "UTC")} 23:00 (UTC)`,
			},
		]);
	});

	it("shows only the created date for a task without an updated date", () => {
		const createdDate = toStoredDate(localMoment(3, 23, 58));
		const card = renderCard(createTask({ createdDate }));

		expect(getCardDates(card)).toEqual([{ text: "3d ago", hover: `${createdDate} (UTC)` }]);
		expect(card.textContent).not.toContain("Updated");
	});
});
