// A due date names a day: the 5th is the 5th in every timezone. It carries no time and no
// timezone meaning, so it is stored, entered and displayed as a plain YYYY-MM-DD string.
// The optional trailing time is tolerated, not honoured: due dates were modelled as UTC
// datetimes before, so stored records can still carry one and must keep their day.
const DUE_DATE_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function invalidDueDate(fieldName: string): Error {
	return new Error(`${fieldName} must be a date in YYYY-MM-DD format (for example, 2026-08-10).`);
}

function isRealCalendarDay(year: number, month: number, day: number): boolean {
	const value = new Date(0);
	value.setUTCFullYear(year, month - 1, day);
	value.setUTCHours(0, 0, 0, 0);
	return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
}

/**
 * Normalize an optional due date to the Markdown source-of-truth representation: the day alone.
 * A value that still carries a time keeps the day it was written with, so reading or editing an
 * older record never moves it.
 */
export function normalizeDueDate(value: unknown, fieldName = "Due date"): string | undefined {
	if (value === undefined || value === null) return undefined;

	const input = String(value).trim();
	if (!input) return undefined;

	const match = input.match(DUE_DATE_PATTERN);
	if (!match) throw invalidDueDate(fieldName);

	const [, year, month, day] = match;
	if (!year || !month || !day) throw invalidDueDate(fieldName);
	if (!isRealCalendarDay(Number(year), Number(month), Number(day))) throw invalidDueDate(fieldName);

	return `${year}-${month}-${day}`;
}
