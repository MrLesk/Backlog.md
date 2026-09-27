import type { Task } from "../../types";

interface AcceptanceCriteriaProgressProps {
	task: Pick<Task, "status" | "acceptanceCriteriaItems">;
	density: "card" | "list";
	className?: string;
}

const normalizeStatus = (status: string) => status.trim().toLowerCase().replace(/\s+/g, "");

export function getAcceptanceCriteriaProgressCounts(
	task: Pick<Task, "status" | "acceptanceCriteriaItems">,
): { checked: number; total: number } | null {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (normalizeStatus(task.status) !== "inprogress" || criteria.length === 0) return null;

	return {
		checked: criteria.reduce((total, criterion) => total + Number(criterion.checked), 0),
		total: criteria.length,
	};
}

const RING_RADIUS = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function AcceptanceCriteriaProgress({
	task,
	density,
	className = "",
}: AcceptanceCriteriaProgressProps) {
	const progress = getAcceptanceCriteriaProgressCounts(task);
	if (!progress) return null;

	const arcLength = (progress.checked / progress.total) * RING_CIRCUMFERENCE;

	return (
		<span
			className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-medium tabular-nums text-blue-600 dark:text-blue-300 ${className}`}
			data-acceptance-criteria-progress
			data-density={density}
			role="progressbar"
			aria-label="Acceptance criteria progress"
			aria-valuemin={0}
			aria-valuemax={progress.total}
			aria-valuenow={progress.checked}
			title={`${progress.checked} of ${progress.total} acceptance criteria checked`}
		>
			<svg
				className={`-rotate-90 shrink-0 ${density === "card" ? "h-3 w-3" : "h-3.5 w-3.5"}`}
				viewBox="0 0 12 12"
				aria-hidden="true"
			>
				<circle
					cx="6"
					cy="6"
					r={RING_RADIUS}
					fill="none"
					strokeWidth="2"
					stroke="currentColor"
					className="text-blue-200 dark:text-blue-400/30"
				/>
				{progress.checked > 0 && (
					<circle
						cx="6"
						cy="6"
						r={RING_RADIUS}
						fill="none"
						strokeWidth="2"
						stroke="currentColor"
						strokeLinecap="round"
						strokeDasharray={`${arcLength} ${RING_CIRCUMFERENCE}`}
					/>
				)}
			</svg>
			<span>
				{progress.checked}/{progress.total}
			</span>
		</span>
	);
}
