import { formatPriorityLabel, getPriorityRank, getPriorityValues } from "../../utils/priority-config.ts";

interface PriorityBarsProps {
	priority?: string;
	/** The configured priorities, highest first. */
	priorities?: readonly string[];
}

const BAR_HEIGHTS = [4, 7.5, 11];

/**
 * The priority of a task as three bars of rising height. The highest configured priority fills all three; a list
 * of more or fewer than three priorities is scaled to three bars, and a task without a priority fills none.
 */
export default function PriorityBars({ priority, priorities }: PriorityBarsProps) {
	const rank = getPriorityRank(priority, priorities);
	const filledBars = Math.ceil((rank * BAR_HEIGHTS.length) / getPriorityValues(priorities).length);
	const name = priority ? `${formatPriorityLabel(priority, priorities)} priority` : "No priority";

	return (
		<span role="img" aria-label={name} title={name} className="inline-flex shrink-0">
			<svg viewBox="0 0 14 11" className="h-[11px] w-3.5" aria-hidden="true">
				{BAR_HEIGHTS.map((height, index) => (
					<rect
						key={height}
						x={index * 5}
						y={11 - height}
						width="3.5"
						height={height}
						rx="1"
						className={index < filledBars ? "fill-ink-2" : "fill-line"}
					/>
				))}
			</svg>
		</span>
	);
}
