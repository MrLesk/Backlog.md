import { describe, expect, it } from "bun:test";
import { isTypingTarget } from "./keyboard";

function makeEvent(target: unknown): KeyboardEvent {
	return { target } as KeyboardEvent;
}

function makeElement(tagName: string, isContentEditable = false): unknown {
	return { tagName, isContentEditable };
}

describe("isTypingTarget", () => {
	it("returns true for INPUT targets", () => {
		const event = makeEvent(makeElement("INPUT"));
		expect(isTypingTarget(event)).toBe(true);
	});

	it("returns true for TEXTAREA targets", () => {
		const event = makeEvent(makeElement("TEXTAREA"));
		expect(isTypingTarget(event)).toBe(true);
	});

	it("returns true for contenteditable elements", () => {
		const event = makeEvent(makeElement("DIV", true));
		expect(isTypingTarget(event)).toBe(true);
	});

	it("returns false for non-input HTMLElement targets", () => {
		const event = makeEvent(makeElement("DIV"));
		expect(isTypingTarget(event)).toBe(false);
	});

	it("returns false when target is not an HTMLElement", () => {
		const event = makeEvent({ foo: "bar" });
		expect(isTypingTarget(event)).toBe(false);
	});

	it("returns false when target is null", () => {
		const event = makeEvent(null);
		expect(isTypingTarget(event)).toBe(false);
	});
});
