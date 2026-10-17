import { getPriorityValues, normalizePriorityValue } from "../utils/priority-config.ts";

/**
 * The priority marker of the TUI: one arrow, or nothing for a priority that is not in the
 * configured list. Task list rows draw it in place of the dash before the title, and task details
 * draw it after the priority name.
 *
 * The arrow's direction comes from the priority's place in the configured order, so it reads
 * without color and for a list of any length: up above the middle of the list, down below it,
 * and right for the middle entry of an odd-length list. `now, next, later` gives up, right, down.
 * The colors only repeat the direction.
 *
 * On a terminal without Unicode the arrows are drawn as `^`, `>` and `v` (see createScreen).
 * Each color is closed by name, so text dimmed with an outer color tag stays dimmed after it.
 */
export function formatPriorityMarker(priority: string | undefined, configuredPriorities?: readonly string[]): string {
	const priorities = getPriorityValues(configuredPriorities);
	const position = priorities.indexOf(normalizePriorityValue(priority) ?? "");
	if (position === -1) return "";

	const middle = (priorities.length - 1) / 2;
	if (position < middle) return "{red-fg}↑{/red-fg}";
	if (position > middle) return "{green-fg}↓{/green-fg}";
	return "{yellow-fg}→{/yellow-fg}";
}
