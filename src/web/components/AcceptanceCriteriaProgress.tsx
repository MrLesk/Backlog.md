import type { Task } from "../../types";

interface AcceptanceCriteriaProgressProps {
	task: Pick<Task, "status" | "acceptanceCriteriaItems">;
	cells: 5 | 10;
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

export default function AcceptanceCriteriaProgress({
	task,
	cells,
	className = "",
}: AcceptanceCriteriaProgressProps) {
	const progress = getAcceptanceCriteriaProgressCounts(task);
	if (!progress) return null;

	const filledCells = Math.round((progress.checked / progress.total) * cells);
	const bar = `[${"█".repeat(filledCells)}${"░".repeat(cells - filledCells)}]`;

	return (
		<span
			className={`inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] font-medium text-blue-600 dark:text-blue-300 ${className}`}
			data-acceptance-criteria-progress
			data-cell-count={cells}
			role="progressbar"
			aria-label="Acceptance criteria progress"
			aria-valuemin={0}
			aria-valuemax={progress.total}
			aria-valuenow={progress.checked}
			title={`${progress.checked} of ${progress.total} acceptance criteria checked`}
		>
			<span aria-hidden="true">{bar}</span>
			<span>{progress.checked}/{progress.total}</span>
		</span>
	);
}
