interface TaskBranchProps {
	branch: string;
}

/** The branch a task was read from, for tasks that live on another branch and are read-only here. */
export default function TaskBranch({ branch }: TaskBranchProps) {
	return (
		<span
			className="inline-flex min-w-0 items-center gap-1 font-mono text-[11.5px] font-medium text-ink-2"
			title={`Read-only task from the ${branch} branch`}
		>
			<svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden="true">
				<path
					d="M4.5 5.5v5M11.5 7c0 2.5-3 2-5.5 3.2M6 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM6 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM13 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.4"
				/>
			</svg>
			<span className="sr-only">Branch: </span>
			<span className="truncate">{branch}</span>
		</span>
	);
}
