export type UtcDateDisplayOptions = {
	appendUtcLabel?: boolean;
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

export function formatUtcDateForDisplay(dateStr: string | undefined, options: UtcDateDisplayOptions = {}): string {
	const value = (dateStr ?? "").trim().replace(utcLabelPattern, "").trim();
	if (!value) return "";

	const displayValue = normalizeUtcDateDisplay(value);
	return options.appendUtcLabel ? `${displayValue} (UTC)` : displayValue;
}
