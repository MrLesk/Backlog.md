import { useState } from "react";
import type { DuplicateGroup } from "../../utils/duplicate-detection";
import { buildDuplicateCleanupPrompt } from "../../utils/duplicate-detection";

interface DuplicateIdWarningProps {
	groups: DuplicateGroup[];
}

const MAX_VISIBLE_GROUPS = 3;
const MAX_VISIBLE_TASKS_PER_GROUP = 3;

function formatTaskLocation(filePath?: string): string | null {
	if (!filePath) return null;

	const normalized = filePath.replace(/\\/g, "/");
	const backlogIndex = normalized.indexOf("/backlog/");
	if (backlogIndex >= 0) {
		return normalized.slice(backlogIndex + 1);
	}

	return normalized;
}

async function copyTextToClipboard(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			// Fall back for browsers that deny async clipboard access in local sessions.
		}
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.top = "0";
	textarea.style.left = "0";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.focus();
	textarea.select();

	let copied = false;
	try {
		copied = document.execCommand("copy");
	} finally {
		textarea.remove();
	}

	if (!copied) {
		throw new Error("Clipboard copy failed");
	}
}

export function DuplicateIdWarning({ groups }: DuplicateIdWarningProps) {
	const [dismissed, setDismissed] = useState(false);
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

	if (dismissed || groups.length === 0) return null;

	const duplicateTaskCount = groups.reduce((count, group) => count + group.tasks.length, 0);
	const visibleGroups = groups.slice(0, MAX_VISIBLE_GROUPS);
	const hiddenGroupCount = groups.length - visibleGroups.length;
	const copyLabel =
		copyState === "copied"
			? "Copied"
			: copyState === "failed"
				? "Copy failed"
				: "Copy repair instructions";

	const handleCopyInstructions = async () => {
		const prompt = buildDuplicateCleanupPrompt(groups);
		try {
			await copyTextToClipboard(prompt);
			setCopyState("copied");
		} catch {
			setCopyState("failed");
		}
		window.setTimeout(() => setCopyState("idle"), 2000);
	};

	return (
		<section
			className="border-b border-amber-200 bg-amber-50/95 px-2 py-2 text-sm text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100 sm:px-6 sm:py-3 lg:px-8"
			aria-live="polite"
		>
			<div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex min-w-0 gap-3">
					<div className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-white text-amber-700 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200 sm:flex">
						<svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fillRule="evenodd"
								d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
								clipRule="evenodd"
							/>
						</svg>
					</div>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<h2 className="text-xs font-semibold text-gray-950 dark:text-gray-50 sm:text-sm">
								<span className="sm:hidden">Duplicate IDs</span>
								<span className="hidden sm:inline">Duplicate task IDs need repair</span>
							</h2>
							<span className="hidden rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:ring-amber-700 sm:inline-flex">
								{groups.length} {groups.length === 1 ? "group" : "groups"} · {duplicateTaskCount} tasks
							</span>
						</div>
						<p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-100/90 sm:hidden">
							{groups.length} {groups.length === 1 ? "group" : "groups"}
						</p>
						<p className="mt-1 hidden max-w-4xl text-sm text-amber-900/90 dark:text-amber-100/90 sm:block">
							Merged task files share IDs, so one task per duplicate ID can be hidden in combined views until the IDs are unique.
						</p>
						<div className="mt-3 hidden gap-2 sm:grid xl:grid-cols-2 2xl:grid-cols-3">
							{visibleGroups.map((group) => (
								<div
									key={group.id}
									className="min-w-0 rounded-md border border-amber-200 bg-white/80 p-2.5 dark:border-amber-800 dark:bg-gray-950/35"
								>
									<div className="flex items-center gap-2">
										<span className="font-mono text-xs font-semibold text-amber-800 dark:text-amber-200">{group.id}</span>
										<span className="text-xs text-amber-700 dark:text-amber-300">
											{group.tasks.length} duplicate {group.tasks.length === 1 ? "task" : "tasks"}
										</span>
									</div>
									<ul className="mt-1.5 space-y-1">
										{group.tasks.slice(0, MAX_VISIBLE_TASKS_PER_GROUP).map((task) => {
											const location = formatTaskLocation(task.filePath);
											return (
												<li key={`${group.id}-${task.filePath ?? task.title}`} className="min-w-0">
													<div className="truncate text-xs font-medium text-gray-900 dark:text-gray-100" title={task.title}>
														{task.title || "Untitled task"}
													</div>
													{location && (
														<div className="truncate font-mono text-[11px] text-amber-700/80 dark:text-amber-300/80" title={location}>
															{location}
														</div>
													)}
												</li>
											);
										})}
										{group.tasks.length > MAX_VISIBLE_TASKS_PER_GROUP && (
											<li className="text-xs text-amber-700 dark:text-amber-300">
												+{group.tasks.length - MAX_VISIBLE_TASKS_PER_GROUP} more tasks in this ID
											</li>
										)}
									</ul>
								</div>
							))}
						</div>
						{hiddenGroupCount > 0 && (
							<p className="mt-2 hidden text-xs text-amber-800 dark:text-amber-200 sm:block">
								+{hiddenGroupCount} more duplicate {hiddenGroupCount === 1 ? "group" : "groups"} included in the copied instructions.
							</p>
						)}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1 self-start sm:gap-2 lg:self-center">
					<button
						type="button"
						onClick={handleCopyInstructions}
						className="inline-flex h-8 w-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-amber-700 text-xs font-semibold text-white transition-colors duration-200 hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-amber-50 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400 dark:focus:ring-amber-300 dark:focus:ring-offset-amber-950 sm:w-auto sm:px-3 sm:py-2"
						aria-label={copyLabel}
						title={copyLabel}
					>
						<svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v8A1.5 1.5 0 0 1 14.5 13h-6A1.5 1.5 0 0 1 7 11.5v-8Z" />
							<path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H6v6.5A2.5 2.5 0 0 0 8.5 14H13v.5a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 4 14.5v-8Z" />
						</svg>
						<span className="hidden sm:inline">{copyLabel}</span>
					</button>
					<button
						type="button"
						onClick={() => setDismissed(true)}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-800 transition-colors duration-200 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-amber-50 dark:text-amber-100 dark:hover:bg-amber-900 dark:focus:ring-amber-300 dark:focus:ring-offset-amber-950"
						aria-label="Dismiss duplicate task ID warning"
						title="Dismiss duplicate task ID warning"
					>
						<svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
						</svg>
					</button>
				</div>
			</div>
		</section>
	);
}
