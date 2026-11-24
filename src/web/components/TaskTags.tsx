import type { Task } from "../../types";

interface TaskTagsProps {
	task: Pick<Task, "type" | "project" | "labels">;
	/** The configured projects. A task's project is shown only while projects are configured. */
	projects?: readonly string[];
}

const MAX_LABELS = 3;
const CHIP = "inline-block max-w-40 truncate rounded-chip px-1.5 py-0.5 text-[11.5px] font-medium leading-4 text-ink-2";
const OUTLINED_CHIP = `${CHIP} ring-1 ring-line ring-inset`;

/**
 * The type, project and labels of a task as quiet chips: type and project outlined, labels filled, at most three
 * labels and a count of the rest. Rows of the list and cards of the board both show them through this component.
 */
export default function TaskTags({ task, projects }: TaskTagsProps) {
	const type = task.type?.trim();
	const project = projects?.length ? task.project?.trim() : undefined;
	const shownLabels = task.labels.slice(0, MAX_LABELS);
	const hiddenLabels = task.labels.slice(MAX_LABELS);

	return (
		<>
			{type && (
				<span data-task-type={type} title={`Type: ${type}`} className={OUTLINED_CHIP}>
					<span className="sr-only">Type: </span>
					{type}
				</span>
			)}
			{project && (
				<span data-task-project={project} title={`Project: ${project}`} className={OUTLINED_CHIP}>
					<span className="sr-only">Project: </span>
					<svg viewBox="0 0 16 16" className="mr-1 inline size-3 align-[-1px]" aria-hidden="true">
						<path
							d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z M2.5 5 8 7.5 13.5 5 M8 7.5v6"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.4"
							strokeLinejoin="round"
						/>
					</svg>
					{project}
				</span>
			)}
			{shownLabels.map((label) => (
				<span key={label} title={label} className={`${CHIP} bg-surface-2`}>
					{label}
				</span>
			))}
			{hiddenLabels.length > 0 && (
				<span title={hiddenLabels.join(", ")} className="font-mono text-[11.5px] text-ink-3">
					+{hiddenLabels.length}
				</span>
			)}
		</>
	);
}
