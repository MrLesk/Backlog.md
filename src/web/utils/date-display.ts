import { DATE_TIME_REGEX, parseIntStrict, parseStoredUtcDate } from "../../utils/date-utc.ts";

export { parseStoredUtcDate };

export function formatStoredUtcDateForDisplay(dateStr: string): string {
	const parsed = parseStoredUtcDate(dateStr);
	if (!parsed) return dateStr;

	if (DATE_TIME_REGEX.test(dateStr.trim())) {
		return parsed.toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		});
	}

	return parsed.toLocaleDateString();
}

export function storedUtcToDateTimeLocal(dateStr: string): string {
	const parsed = parseStoredUtcDate(dateStr);
	if (!parsed) return dateStr.replace(" ", "T");

	const year = parsed.getFullYear();
	const month = String(parsed.getMonth() + 1).padStart(2, "0");
	const day = String(parsed.getDate()).padStart(2, "0");
	const hours = String(parsed.getHours()).padStart(2, "0");
	const minutes = String(parsed.getMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function dateTimeLocalToStoredUtc(localStr: string): string {
	const normalized = localStr.trim();
	if (!normalized) return "";

	const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
	if (!match) return normalized.replace("T", " ");

	const year = parseIntStrict(match[1]!);
	const month = parseIntStrict(match[2]!) - 1;
	const day = parseIntStrict(match[3]!);
	const hours = parseIntStrict(match[4]!);
	const minutes = parseIntStrict(match[5]!);

	const date = new Date(year, month, day, hours, minutes, 0);
	return date.toISOString().slice(0, 16).replace("T", " ");
}

export function formatStoredUtcDateForCompactDisplay(dateStr: string, now: Date = new Date()): string {
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

	return parsed.toLocaleDateString();
}
