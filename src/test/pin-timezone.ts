import { afterAll, beforeAll } from "bun:test";

/**
 * Pins the process timezone for one test file so assertions on rendered local timestamps
 * never depend on the machine running the tests. The previous value is restored afterwards
 * because bun runs test files in a shared process.
 */
export function pinTimeZone(timeZone: string): void {
	// Deleting TZ again would not restore the resolved zone, so capture the effective one.
	const previous = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

	beforeAll(() => {
		process.env.TZ = timeZone;
	});

	afterAll(() => {
		process.env.TZ = previous;
	});
}
