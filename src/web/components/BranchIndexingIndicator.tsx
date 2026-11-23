import { useEffect, useRef, useState } from "react";

interface BranchIndexingIndicatorProps {
	message?: string | null;
	/** How long the loading message must persist before the indicator appears. */
	appearDelayMs?: number;
	/** Fade-out duration before the indicator unmounts. */
	exitDurationMs?: number;
}

/**
 * Shell-level indicator for cross-branch indexing. Renders a compact status chip
 * in the header plus a hairline sweep bar on the header's bottom border.
 * Appears only after the indexing state persists (no flash on fast completion)
 * and fades out cleanly when indexing finishes.
 */
export function BranchIndexingIndicator({
	message,
	appearDelayMs = 250,
	exitDurationMs = 200,
}: BranchIndexingIndicatorProps) {
	const [mounted, setMounted] = useState(false);
	const [active, setActive] = useState(false);
	const lastMessageRef = useRef<string | null>(null);
	if (message) lastMessageRef.current = message;

	useEffect(() => {
		if (message) {
			if (mounted) {
				// Runs post-paint, so the first activation still transitions from the
				// hidden state the chip mounted with.
				setActive(true);
				return;
			}
			const timer = window.setTimeout(() => setMounted(true), appearDelayMs);
			return () => window.clearTimeout(timer);
		}
		if (!mounted) return;
		setActive(false);
		const timer = window.setTimeout(() => setMounted(false), exitDurationMs);
		return () => window.clearTimeout(timer);
	}, [message, mounted, appearDelayMs, exitDurationMs]);

	if (!mounted) return null;

	const detail = lastMessageRef.current ?? undefined;
	return (
		<>
			<div
				role="status"
				title={detail}
				className={`flex items-center gap-2 rounded-chip bg-surface-2 px-2.5 py-1 text-xs font-medium text-accent-text transition-all duration-200 ${
					active ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0"
				}`}
			>
				<span
					className="h-3 w-3 shrink-0 animate-spin rounded-circle border-2 border-line border-t-accent-strong motion-reduce:animate-none"
					aria-hidden="true"
				/>
				<span aria-hidden="true" className="hidden sm:inline">
					Indexing branches
				</span>
				<span className="sr-only">{detail ?? "Indexing branches"}</span>
			</div>
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden transition-opacity duration-200 motion-reduce:hidden ${
					active ? "opacity-100" : "opacity-0"
				}`}
			>
				<div className="animate-indexing-sweep h-full w-2/5 bg-gradient-to-r from-transparent via-accent-strong to-transparent" />
			</div>
		</>
	);
}
