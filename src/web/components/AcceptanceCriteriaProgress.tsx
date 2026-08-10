import type { Task } from "../../types";

interface AcceptanceCriteriaProgressProps {
	task: Pick<Task, "status" | "acceptanceCriteriaItems">;
	cells: 5 | 10;
	className?: string;
}

const normalizeStatus = (status: string) => status.trim().toLowerCase().replace(/\s+/g, "");

export default function AcceptanceCriteriaProgress({
	task,
	cells,
	className = "",
}: AcceptanceCriteriaProgressProps) {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (normalizeStatus(task.status) !== "inprogress" || criteria.length === 0) return null;

	const checked = criteria.reduce((total, criterion) => total + Number(criterion.checked), 0);
	const filledCells = Math.round((checked / criteria.length) * cells);
	const bar = `[${"█".repeat(filledCells)}${"░".repeat(cells - filledCells)}]`;

	return (
		<span
			className={`inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] font-medium text-blue-600 dark:text-blue-300 ${className}`}
			data-acceptance-criteria-progress
			data-cell-count={cells}
			role="progressbar"
			aria-label="Acceptance criteria progress"
			aria-valuemin={0}
			aria-valuemax={criteria.length}
			aria-valuenow={checked}
			title={`${checked} of ${criteria.length} acceptance criteria checked`}
		>
			<span aria-hidden="true">{bar}</span>
			<span>{checked}/{criteria.length}</span>
		</span>
	);
}
