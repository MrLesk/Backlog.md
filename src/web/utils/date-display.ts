import { formatUtcDateForDisplay } from "../../utils/utc-date-display.ts";

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

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

export function formatStoredUtcDateForDisplay(dateStr: string, dateFormat?: string): string {
	return formatUtcDateForDisplay(dateStr, { dateFormat });
}

export function formatStoredUtcDateForCompactDisplay(
	dateStr: string,
	dateFormat?: string,
	now: Date = new Date(),
): string {
	const normalized = dateStr.trim();
	if (!normalized) return "—";

	const parsed = parseStoredUtcDate(normalized);
	if (!parsed) return normalized;

	const diffMs = now.getTime() - parsed.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays >= 0) {
		if (diffDays === 0) return "today";
		if (diffDays === 1) return "yesterday";
		if (diffDays < 7) return `${diffDays}d ago`;
	}

	// Absolute fallback stays compact: format only the date portion of the stored value.
	return formatUtcDateForDisplay(normalized.slice(0, 10), { dateFormat });
}
