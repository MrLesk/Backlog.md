import type { BacklogConfig, ConfigurableCardField } from "../types/index.ts";

/**
 * Returns the set of card fields the kanban should hide.
 *
 * Resolution rules:
 *  - `config.board?.card?.hide` undefined or empty array → empty set
 *    (show all fields; back-compat default — the new default also
 *    includes the milestone slot for tasks that have a milestone).
 *  - `config.board?.card?.hide` non-empty → set of those entries.
 *
 * Returning a Set (rather than a list) keeps the lookup O(1) on the
 * render path. The Set is intentionally `ReadonlySet` so callers can't
 * mutate the resolved value — re-resolve from config to pick up edits.
 */
export function resolveCardHiddenFields(config: BacklogConfig): ReadonlySet<ConfigurableCardField> {
	const hide = config.board?.card?.hide;
	if (!hide || hide.length === 0) return EMPTY_HIDDEN;
	return new Set(hide);
}

const EMPTY_HIDDEN: ReadonlySet<ConfigurableCardField> = new Set();
