import { formatUtcDateForDisplay } from "../../utils/utc-date-display.ts";

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

export type StoredDateDisplayOptions = {
	dateFormat?: string;
	/**
	 * IANA timezone used to render the local value. Defaults to the runtime timezone;
	 * tests pass it explicitly so results never depend on the machine's timezone.
	 */
	timeZone?: string;
};

export type StoredDateDisplay = {
	/** Value to render: local time for stored timestamps, unchanged for date-only values. */
	text: string;
	/**
	 * Canonical stored value with the (UTC) marker, for the title attribute.
	 * Absent when nothing was converted, so a date-only value never claims a time it does not have.
	 */
	title?: string;
};

function parseIntStrict(value: string): number {
	return Number.parseInt(value, 10);
}

export function parseStoredUtcDate(dateStr: string): Date | null {
	const normalized = dateStr.trim();
	if (!normalized) return null;

	const dateTimeMatch = normalized.match(DATE_TIME_REGEX);
	if (dateTimeMatch) {
		const y = dateTimeMatch[1];
		const m = dateTimeMatch[2];
		const d = dateTimeMatch[3];
		const hh = dateTimeMatch[4];
		const mm = dateTimeMatch[5];
		if (!y || !m || !d || !hh || !mm) return null;
		const year = parseIntStrict(y);
		const month = parseIntStrict(m);
		const day = parseIntStrict(d);
		const hours = parseIntStrict(hh);
		const minutes = parseIntStrict(mm);
		const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

		if (
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== month - 1 ||
			date.getUTCDate() !== day ||
			date.getUTCHours() !== hours ||
			date.getUTCMinutes() !== minutes
		) {
			return null;
		}

		return date;
	}

	const dateOnlyMatch = normalized.match(DATE_ONLY_REGEX);
	if (dateOnlyMatch) {
		const y = dateOnlyMatch[1];
		const m = dateOnlyMatch[2];
		const d = dateOnlyMatch[3];
		if (!y || !m || !d) return null;
		const year = parseIntStrict(y);
		const month = parseIntStrict(m);
		const day = parseIntStrict(d);
		const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

		if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
			return null;
		}

		return date;
	}

	return null;
}

// Building a formatter costs far more than using one, and a task list renders a date per row.
// Keyed by the resolved zone, so a cached formatter is never reused after the runtime zone changes.
const localFormatters = new Map<string, Intl.DateTimeFormat>();

function localFormatterFor(timeZone: string | undefined): Intl.DateTimeFormat {
	const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	const cached = localFormatters.get(zone);
	if (cached) return cached;

	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: zone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	});
	localFormatters.set(zone, formatter);
	return formatter;
}

/** Renders an instant as `yyyy-mm-dd hh:mm` wall-clock time in the given (or runtime) timezone. */
function toLocalCanonical(date: Date, timeZone?: string): string | null {
	const parts = localFormatterFor(timeZone).formatToParts(date);

	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value;
	const year = part("year");
	const month = part("month");
	const day = part("day");
	const hours = part("hour");
	const minutes = part("minute");
	if (!year || !month || !day || !hours || !minutes) return null;

	return `${year.padStart(4, "0")}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Web-only display of a stored UTC date.
 *
 * The browser is the one surface that knows the viewer's timezone, so a stored timestamp
 * renders as local time with the canonical UTC value on hover. Date-only values carry no
 * time to convert: they render unchanged and get no hover.
 */
export function formatStoredDateForDisplay(
	dateStr: string | undefined,
	options: StoredDateDisplayOptions = {},
): StoredDateDisplay {
	const canonicalUtc = formatUtcDateForDisplay(dateStr);
	if (!canonicalUtc) return { text: "" };

	const local = localCanonicalOf(canonicalUtc, options.timeZone);
	if (!local) return { text: formatUtcDateForDisplay(canonicalUtc, { dateFormat: options.dateFormat }) };

	return {
		text: formatUtcDateForDisplay(local, { dateFormat: options.dateFormat }),
		title: utcTitleOf(canonicalUtc, options.dateFormat),
	};
}

/** The hover value: the canonical stored value, arranged by the configured format, marked UTC. */
function utcTitleOf(canonicalUtc: string, dateFormat?: string): string {
	return formatUtcDateForDisplay(canonicalUtc, { dateFormat, appendUtcLabel: true });
}

/** Local rendering of a canonical UTC value, or null when there is no time to convert. */
function localCanonicalOf(canonicalUtc: string, timeZone?: string): string | null {
	if (!DATE_TIME_REGEX.test(canonicalUtc)) return null;
	const parsed = parseStoredUtcDate(canonicalUtc);
	return parsed ? toLocalCanonical(parsed, timeZone) : null;
}

/**
 * Compact variant for dense lists: recent values render relatively, older ones fall back
 * to the local date. Both keep the canonical UTC value on hover when there is a time.
 */
export function formatStoredDateForCompactDisplay(
	dateStr: string | undefined,
	options: StoredDateDisplayOptions = {},
	now: Date = new Date(),
): StoredDateDisplay {
	const canonicalUtc = formatUtcDateForDisplay(dateStr);
	if (!canonicalUtc) return { text: "—" };
	if (!parseStoredUtcDate(canonicalUtc)) return { text: canonicalUtc };

	const local = localCanonicalOf(canonicalUtc, options.timeZone);
	const title = local ? utcTitleOf(canonicalUtc, options.dateFormat) : undefined;

	// "today" and "yesterday" name calendar days, so compare the days the viewer actually reads:
	// a value less than 24 hours old can still belong to the previous local day.
	const localDate = (local ?? canonicalUtc).slice(0, 10);
	const todayLocal = toLocalCanonical(now, options.timeZone)?.slice(0, 10);
	const diffDays = todayLocal ? calendarDaysBetween(localDate, todayLocal) : null;

	if (diffDays !== null && diffDays >= 0 && diffDays < 7) {
		if (diffDays === 0) return { text: "today", title };
		if (diffDays === 1) return { text: "yesterday", title };
		return { text: `${diffDays}d ago`, title };
	}

	// Absolute fallback stays compact: the date portion only, in the viewer's timezone.
	return { text: formatUtcDateForDisplay(localDate, { dateFormat: options.dateFormat }), title };
}

/** Whole calendar days from `earlier` to `later`, both `yyyy-mm-dd` read in the same timezone. */
function calendarDaysBetween(earlier: string, later: string): number | null {
	const from = parseStoredUtcDate(earlier);
	const to = parseStoredUtcDate(later);
	if (!from || !to) return null;
	return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
