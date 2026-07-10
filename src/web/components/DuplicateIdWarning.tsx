import { useState } from "react";
import type { DuplicateRepairPlan } from "../../core/duplicate-task-repair";
import { DuplicateIdRepairModal } from "./DuplicateIdRepairModal";

interface DuplicateIdWarningProps {
	plan: DuplicateRepairPlan | null;
	onRepaired: () => Promise<void>;
}

export function DuplicateIdWarning({ plan, onRepaired }: DuplicateIdWarningProps) {
	const [dismissed, setDismissed] = useState(false);
	const [isRepairOpen, setIsRepairOpen] = useState(false);

	if (!plan || !Array.isArray(plan.groups) || plan.groups.length === 0 || dismissed) return null;

	const duplicateTaskCount = plan.groups.reduce((count, group) => count + group.tasks.length, 0);

	return (
		<>
			<section
				className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100 sm:px-6 lg:px-8"
				aria-live="polite"
			>
				<div className="flex min-h-9 flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<svg className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fillRule="evenodd"
								d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
								clipRule="evenodd"
							/>
						</svg>
						<p className="truncate text-sm">
							<span className="font-semibold">Duplicate task IDs:</span> {plan.groups.length} {plan.groups.length === 1 ? "group" : "groups"} across {duplicateTaskCount} files. Some tasks may be hidden.
						</p>
					</div>
					<div className="ml-auto flex shrink-0 items-center gap-2">
						<button
							type="button"
							onClick={() => setIsRepairOpen(true)}
							className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-amber-50 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
						>
							Review repair
						</button>
						<button
							type="button"
							onClick={() => setDismissed(true)}
							className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-amber-100 dark:hover:bg-amber-900"
							aria-label="Dismiss duplicate task ID warning"
						>
							<span aria-hidden="true" className="text-xl leading-none">×</span>
						</button>
					</div>
				</div>
			</section>
			<DuplicateIdRepairModal
				isOpen={isRepairOpen}
				plan={plan}
				onClose={() => setIsRepairOpen(false)}
				onRepaired={onRepaired}
			/>
		</>
	);
}
