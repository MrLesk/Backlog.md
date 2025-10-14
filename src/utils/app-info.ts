/**
 * Lightweight helper for package metadata that does not justify build-time embedding yet.
 * If we ever need to embed the value, mirror the approach used in version.ts.
 */
export function getPackageName(): string {
	return "backlog.md";
}
