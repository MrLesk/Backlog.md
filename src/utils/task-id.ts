import type { Task } from "../types/index.ts";
import { escapeRegex, extractAnyPrefix, normalizeId } from "./prefix-config.ts";

const DEFAULT_TASK_PREFIX = "task";
const NUMERIC_TASK_ID_PATTERN = /^(?:[a-zA-Z]+-)?[0-9]+(?:\.[0-9]+)*$/;
const LEGACY_TASK_ID_PATTERN = /^[a-zA-Z]+-[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*$/;

export type TaskIdResolution =
	| { status: "found"; task: Task }
	| { status: "ambiguous"; tasks: Task[] }
	| { status: "invalid" }
	| { status: "not-found" };

/**
 * Normalize a task ID by ensuring the prefix is present and uppercase.
 * An existing prefix is preserved when the caller does not provide one.
 */
export function normalizeTaskId(taskId: string, prefix: string = DEFAULT_TASK_PREFIX): string {
	const inferredPrefix = extractAnyPrefix(taskId);
	const effectivePrefix = inferredPrefix && prefix === DEFAULT_TASK_PREFIX ? inferredPrefix : prefix;
	return normalizeId(taskId, effectivePrefix);
}

function extractTaskBody(value: string, prefix: string = DEFAULT_TASK_PREFIX): string | null {
	const trimmed = value.trim();
	if (trimmed === "") return "";
	const prefixPattern = new RegExp(`^(?:${escapeRegex(prefix)}-)?([0-9]+(?:\\.[0-9]+)*)$`, "i");
	const match = trimmed.match(prefixPattern);
	return match?.[1] ?? null;
}

function canonicalDecimalSegment(segment: string): string {
	const withoutLeadingZeroes = segment.replace(/^0+/, "");
	return withoutLeadingZeroes || "0";
}

/** Compare dotted decimal ID bodies without coercing segments to JavaScript numbers. */
export function numericIdBodiesEqual(left: string, right: string): boolean {
	const leftSegments = left.split(".");
	const rightSegments = right.split(".");
	if (leftSegments.length !== rightSegments.length) {
		return false;
	}
	if (!leftSegments.every((segment) => /^\d+$/.test(segment))) {
		return false;
	}
	if (!rightSegments.every((segment) => /^\d+$/.test(segment))) {
		return false;
	}

	return leftSegments.every(
		(segment, index) => canonicalDecimalSegment(segment) === canonicalDecimalSegment(rightSegments[index] ?? ""),
	);
}

/**
 * Compare task IDs by prefix and numeric segments.
 * Leading zeroes are cosmetic, including within dotted subtask IDs.
 */
export function taskIdsEqual(left: string, right: string, prefix: string = DEFAULT_TASK_PREFIX): boolean {
	const leftPrefix = extractAnyPrefix(left);
	const rightPrefix = extractAnyPrefix(right);
	const effectivePrefix = leftPrefix ?? rightPrefix ?? prefix;

	const leftBody = extractTaskBody(left, effectivePrefix);
	const rightBody = extractTaskBody(right, effectivePrefix);

	if (leftBody && rightBody) {
		return numericIdBodiesEqual(leftBody, rightBody);
	}

	return normalizeTaskId(left, effectivePrefix).toLowerCase() === normalizeTaskId(right, effectivePrefix).toLowerCase();
}

export function isNumericTaskId(value: string): boolean {
	return NUMERIC_TASK_ID_PATTERN.test(value.trim());
}

export function isValidTaskId(value: string): boolean {
	const trimmed = value.trim();
	return isNumericTaskId(trimmed) || LEGACY_TASK_ID_PATTERN.test(trimmed);
}

/**
 * Resolve a human-facing route ID without guessing when canonical IDs collide.
 */
export function resolveTaskById(tasks: Task[], inputId: string): TaskIdResolution {
	const normalizedInput = inputId.trim();
	if (!isValidTaskId(normalizedInput)) {
		return { status: "invalid" };
	}

	const matches = tasks.filter((task) => taskIdsEqual(normalizedInput, task.id));
	if (matches.length === 0) {
		return { status: "not-found" };
	}
	if (matches.length > 1) {
		return { status: "ambiguous", tasks: matches };
	}

	const task = matches[0];
	return task ? { status: "found", task } : { status: "not-found" };
}
