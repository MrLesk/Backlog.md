import type { Task } from "../../types/index.ts";
import { SuccessToast } from "./SuccessToast.tsx";

export interface AppAutoCommitNotice {
	id: number;
	message: string;
}

interface AppSuccessToastsProps {
	autoCommitNotices: readonly AppAutoCommitNotice[];
	taskConfirmation: { task: Task; isDraft: boolean } | null;
	onDismissAutoCommitNotice: (id: number) => void;
	onDismissTaskConfirmation: () => void;
}

export function AppSuccessToasts({
	autoCommitNotices,
	taskConfirmation,
	onDismissAutoCommitNotice,
	onDismissTaskConfirmation,
}: AppSuccessToastsProps) {
	if (autoCommitNotices.length === 0 && !taskConfirmation) return null;

	return (
		<div className="fixed top-4 right-4 z-50 flex max-w-[min(32rem,calc(100vw-2rem))] flex-col gap-3" data-testid="app-success-toast-stack">
			{autoCommitNotices.map((notice) => (
				<SuccessToast
					key={notice.id}
					message={notice.message}
					onDismiss={() => onDismissAutoCommitNotice(notice.id)}
					stacked
				/>
			))}
			{taskConfirmation && (
				<SuccessToast
					message={`${taskConfirmation.isDraft ? "Draft" : "Task"} "${taskConfirmation.task.title}" created successfully! (${taskConfirmation.task.id.replace("task-", "")})`}
					onDismiss={onDismissTaskConfirmation}
					stacked
					icon={
						<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					}
				/>
			)}
		</div>
	);
}
