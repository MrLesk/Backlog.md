/** Explicit UTC for generated timestamps, keeping the existing minute precision. */
export function formatUtcTimestamp(date = new Date()): string {
	return `${date.toISOString().slice(0, 16)}:00Z`;
}

/** Read stored instants consistently: legacy timezone-less values mean UTC on every host. */
export function parseStoredUtcDate(dateStr: string | undefined): Date | null {
	const match = (dateStr ?? "")
		.trim()
		.match(
			/^(\d{4})-(\d{2})-(\d{2})(?:(?:T|[ \t]+)(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?[ \t]*(Z|[+-]\d{2}:?\d{2})?)?$/i,
		);
	if (!match) return null;
	const [, year, month, day, hours = "00", minutes = "00", seconds = "00", fraction = "", zone = "Z"] = match;
	const wallTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${fraction}`;
	const utc = new Date(`${wallTime}Z`);
	// Date normalizes values such as February 31; reject them, as the existing stored-date reader does.
	if (
		Number.isNaN(utc.getTime()) ||
		utc.getUTCFullYear() !== Number(year) ||
		utc.getUTCMonth() + 1 !== Number(month) ||
		utc.getUTCDate() !== Number(day) ||
		utc.getUTCHours() !== Number(hours) ||
		utc.getUTCMinutes() !== Number(minutes) ||
		utc.getUTCSeconds() !== Number(seconds)
	) {
		return null;
	}
	if (zone.toUpperCase() === "Z") return utc;
	const offset = zone.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
	const date = new Date(`${wallTime}${offset}`);
	return Number.isNaN(date.getTime()) ? null : date;
}
