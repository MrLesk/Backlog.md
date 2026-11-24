import { createStatusResolver } from "../../utils/terminal-status.ts";

interface StatusMarkProps {
	status: string;
	/** The configured statuses in workflow order. */
	statuses: readonly string[];
	/** Hides the mark from assistive technology where the status name is printed beside it. */
	decorative?: boolean;
}

/**
 * The status of a task as a ring that fills with the position of the status in the configured workflow: an empty
 * ring for the first status, a teal pie for the statuses in between, a check for the final status, and a dashed
 * ring for a status that is not configured. The shape, not the color, tells the states apart.
 */
export default function StatusMark({ status, statuses, decorative = false }: StatusMarkProps) {
	const position = statuses.indexOf(createStatusResolver(statuses)(status));
	const finalPosition = statuses.length - 1;
	const name = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": status, title: status };

	return (
		<span className="inline-flex size-3.5 shrink-0" {...name}>
			<svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
				{position === -1 ? (
					<circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" strokeDasharray="2.4 1.8" className="stroke-ink-3" />
				) : position === finalPosition ? (
					<>
						<circle cx="7" cy="7" r="6.75" className="fill-ink" />
						<path
							d="M4.3 7.2l1.8 1.8 3.6-3.9"
							fill="none"
							strokeWidth="1.6"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="stroke-surface"
						/>
					</>
				) : position === 0 ? (
					<circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" className="stroke-ink-3" />
				) : (
					<>
						<circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" className="stroke-accent-strong" />
						<path d={piePath(position / finalPosition)} className="fill-accent-strong" />
					</>
				)}
			</svg>
		</span>
	);
}

/** A pie covering `fraction` of the inner circle, clockwise from twelve o'clock. */
function piePath(fraction: number): string {
	const angle = fraction * 2 * Math.PI;
	const x = (7 + 3.5 * Math.sin(angle)).toFixed(2);
	const y = (7 - 3.5 * Math.cos(angle)).toFixed(2);
	return `M7 7V3.5A3.5 3.5 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y}Z`;
}
