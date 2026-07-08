export type UtcDateDisplayOptions = {
	appendUtcLabel?: boolean;
	/**
	 * Optional display-only format such as "dd/mm/yyyy" or "mm/dd/yyyy hh:mm".
	 * Rearranges the canonical UTC value for display; storage stays canonical.
	 * Invalid formats fall back to the canonical `yyyy-mm-dd[ hh:mm]` output.
	 */
	dateFormat?: string;
};

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timezoneLessDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const explicitTimezoneDateTimePattern =
	/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})$/i;
const utcLabelPattern = /\s+\(UTC\)$/i;

function padDatePart(value: number): string {
	return String(value).padStart(2, "0");
}

function normalizeTimezoneOffset(timezone: string): string {
	if (/^[+-]\d{4}$/.test(timezone)) {
		return `${timezone.slice(0, 3)}:${timezone.slice(3)}`;
	}
	return timezone.toUpperCase() === "Z" ? "Z" : timezone;
}

function formatExplicitTimezoneDateTime(value: string): string | null {
	const match = value.match(explicitTimezoneDateTimePattern);
	if (!match) return null;

	const datePart = match[1];
	const timePart = match[2];
	const timezone = match[3];
	if (!datePart || !timePart || !timezone) return null;

	const date = new Date(`${datePart}T${timePart}${normalizeTimezoneOffset(timezone)}`);
	if (Number.isNaN(date.getTime())) return null;

	const year = date.getUTCFullYear();
	const month = padDatePart(date.getUTCMonth() + 1);
	const day = padDatePart(date.getUTCDate());
	const hours = padDatePart(date.getUTCHours());
	const minutes = padDatePart(date.getUTCMinutes());
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function normalizeUtcDateDisplay(value: string): string {
	const explicitTimezoneDateTime = formatExplicitTimezoneDateTime(value);
	if (explicitTimezoneDateTime) return explicitTimezoneDateTime;

	const dateTimeMatch = value.match(timezoneLessDateTimePattern);
	if (dateTimeMatch) {
		const year = dateTimeMatch[1];
		const month = dateTimeMatch[2];
		const day = dateTimeMatch[3];
		const hours = dateTimeMatch[4];
		const minutes = dateTimeMatch[5];
		if (year && month && day && hours && minutes) {
			return `${year}-${month}-${day} ${hours}:${minutes}`;
		}
	}

	if (dateOnlyPattern.test(value)) return value;

	return value;
}

const canonicalDisplayPattern = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/;

function countToken(value: string, token: string): number {
	return value.split(token).length - 1;
}

/**
 * Rearranges a canonical `yyyy-mm-dd[ hh:mm]` value using a custom display format.
 * The format is split at the first whitespace into a date part and an optional time part.
 * Date part tokens (case-insensitive, each exactly once): yyyy, mm (month), dd; other characters are literal.
 * Time part tokens: hh, mm (minutes). Returns null when the format is invalid.
 */
function applyDateFormat(dateFormat: string, canonicalMatch: RegExpMatchArray): string | null {
	const [, year, month, day, hours, minutes] = canonicalMatch;
	if (!year || !month || !day) return null;

	const trimmedFormat = dateFormat.trim();
	if (!trimmedFormat) return null;

	const whitespaceIndex = trimmedFormat.search(/\s/);
	const datePart = whitespaceIndex === -1 ? trimmedFormat : trimmedFormat.slice(0, whitespaceIndex);
	const timePart = whitespaceIndex === -1 ? "" : trimmedFormat.slice(whitespaceIndex).trim();

	const lowerDatePart = datePart.toLowerCase();
	const hasValidDateTokens =
		countToken(lowerDatePart, "yyyy") === 1 &&
		countToken(lowerDatePart, "mm") === 1 &&
		countToken(lowerDatePart, "dd") === 1;
	if (!hasValidDateTokens) return null;

	if (timePart) {
		const lowerTimePart = timePart.toLowerCase();
		if (countToken(lowerTimePart, "hh") !== 1 || countToken(lowerTimePart, "mm") !== 1) return null;
	}

	// Single-pass replacement: substituted digits are never re-matched.
	const formattedDate = datePart.replace(/yyyy|mm|dd/gi, (token) => {
		const lowerToken = token.toLowerCase();
		if (lowerToken === "yyyy") return year;
		return lowerToken === "mm" ? month : day;
	});

	// Date-only stored values render the date part only; never invent a midnight time.
	if (!hours || !minutes) return formattedDate;

	// Stored values with a time always render it: via the format's time part when
	// present, otherwise by appending the canonical time.
	if (!timePart) return `${formattedDate} ${hours}:${minutes}`;

	const formattedTime = timePart.replace(/hh|mm/gi, (token) => (token.toLowerCase() === "hh" ? hours : minutes));
	return `${formattedDate} ${formattedTime}`;
}

export function formatUtcDateForDisplay(dateStr: string | undefined, options: UtcDateDisplayOptions = {}): string {
	const value = (dateStr ?? "").trim().replace(utcLabelPattern, "").trim();
	if (!value) return "";

	let displayValue = normalizeUtcDateDisplay(value);
	if (options.dateFormat) {
		const canonicalMatch = displayValue.match(canonicalDisplayPattern);
		if (canonicalMatch) {
			displayValue = applyDateFormat(options.dateFormat, canonicalMatch) ?? displayValue;
		}
	}
	return options.appendUtcLabel ? `${displayValue} (UTC)` : displayValue;
}
