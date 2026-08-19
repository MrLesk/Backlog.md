const DATE_TIME_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/;

function createUtcDate(year: number, month: number, day: number, hour: number, minute: number, second: number): Date {
	const value = new Date(0);
	value.setUTCFullYear(year, month - 1, day);
	value.setUTCHours(hour, minute, second, 0);
	return value;
}

function isValidUtcComponents(year: number, month: number, day: number, hour: number, minute: number, second: number) {
	const value = createUtcDate(year, month, day, hour, minute, second);
	return (
		value.getUTCFullYear() === year &&
		value.getUTCMonth() === month - 1 &&
		value.getUTCDate() === day &&
		value.getUTCHours() === hour &&
		value.getUTCMinutes() === minute &&
		value.getUTCSeconds() === second
	);
}

function invalidUtcDateTime(fieldName: string): Error {
	return new Error(
		`${fieldName} must be a valid UTC datetime (for example, 2026-08-10 14:30 or 2026-08-10T14:30Z). Date-only values are not supported.`,
	);
}

function formatUtcMinute(value: Date, fieldName: string): string {
	if (Number.isNaN(value.getTime())) throw invalidUtcDateTime(fieldName);
	const year = value.getUTCFullYear();
	if (year < 0 || year > 9999) throw invalidUtcDateTime(fieldName);
	const pad = (part: number, length = 2) => String(part).padStart(length, "0");
	return `${pad(year, 4)}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
}

/**
 * Normalize an optional datetime to the Markdown source-of-truth representation.
 * Datetimes without an offset are interpreted as UTC; explicit offsets are converted to UTC.
 */
export function normalizeUtcDateTime(value: unknown, fieldName = "Datetime"): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (value instanceof Date) {
		return formatUtcMinute(value, fieldName);
	}

	const input = String(value).trim();
	if (!input) return undefined;
	const match = input.match(DATE_TIME_PATTERN);
	if (!match) throw invalidUtcDateTime(fieldName);

	const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond = "0", rawFraction, rawOffset] = match;
	const year = Number(rawYear);
	const month = Number(rawMonth);
	const day = Number(rawDay);
	const hour = Number(rawHour);
	const minute = Number(rawMinute);
	const second = Number(rawSecond);
	if (!isValidUtcComponents(year, month, day, hour, minute, second)) {
		throw invalidUtcDateTime(fieldName);
	}

	let timestamp = createUtcDate(year, month, day, hour, minute, second).getTime();
	if (rawFraction) {
		timestamp += Number(`0.${rawFraction}`) * 1000;
	}
	if (rawOffset && rawOffset !== "Z") {
		const sign = rawOffset[0] === "+" ? 1 : -1;
		const offsetDigits = rawOffset.slice(1).replace(":", "");
		const offsetHours = Number(offsetDigits.slice(0, 2));
		const offsetMinutes = Number(offsetDigits.slice(2, 4));
		if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) {
			throw invalidUtcDateTime(fieldName);
		}
		timestamp -= sign * (offsetHours * 60 + offsetMinutes) * 60_000;
	}

	return formatUtcMinute(new Date(timestamp), fieldName);
}
