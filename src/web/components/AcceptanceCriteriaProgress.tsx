import type { Task } from "../../types";

interface AcceptanceCriteriaProgressProps {
	task: Pick<Task, "acceptanceCriteriaItems">;
	density: "card" | "list";
}

/**
 * The one rule for showing the ring, in every web placement and every status: a task with
 * at least one acceptance criterion has counts; a task with none gets null and no ring.
 */
export function getAcceptanceCriteriaProgressCounts(
	task: Pick<Task, "acceptanceCriteriaItems">,
): { checked: number; total: number } | null {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (criteria.length === 0) return null;

	return {
		checked: criteria.reduce((total, criterion) => total + Number(criterion.checked), 0),
		total: criteria.length,
	};
}

const RING_RADIUS = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface ProgressRingProps {
	done: number;
	total: number;
	/** What the ring counts, for screen readers, such as "Acceptance criteria progress". */
	label: string;
	/** The tooltip, such as "2 of 3 acceptance criteria checked". */
	title: string;
	density: "card" | "list";
}

/** A ring that fills with done/total, followed by "done/total" in mono. Complete, the count turns from ink-2 to ink. */
export function ProgressRing({ done, total, label, title, density }: ProgressRingProps) {
	const arcLength = total > 0 ? (done / total) * RING_CIRCUMFERENCE : 0;
	return (
		<span
			className={`inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11.5px] font-medium leading-4 ${done === total ? "text-ink" : "text-ink-2"}`}
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={total}
			aria-valuenow={done}
			title={title}
		>
			<svg className={`-rotate-90 shrink-0 ${density === "card" ? "h-3 w-3" : "h-3.5 w-3.5"}`} viewBox="0 0 12 12" aria-hidden="true">
				<circle cx="6" cy="6" r={RING_RADIUS} fill="none" strokeWidth="2" className="stroke-line" />
				{done > 0 && (
					<circle
						cx="6"
						cy="6"
						r={RING_RADIUS}
						fill="none"
						strokeWidth="2"
						strokeLinecap="round"
						strokeDasharray={`${arcLength} ${RING_CIRCUMFERENCE}`}
						className="stroke-accent-strong"
					/>
				)}
			</svg>
			<span>
				{done}/{total}
			</span>
		</span>
	);
}

export default function AcceptanceCriteriaProgress({ task, density }: AcceptanceCriteriaProgressProps) {
	const progress = getAcceptanceCriteriaProgressCounts(task);
	if (!progress) return null;

	return (
		<span className="inline-flex" data-acceptance-criteria-progress data-density={density}>
			<ProgressRing
				done={progress.checked}
				total={progress.total}
				label="Acceptance criteria progress"
				title={`${progress.checked} of ${progress.total} acceptance criteria checked`}
				density={density}
			/>
		</span>
	);
}
