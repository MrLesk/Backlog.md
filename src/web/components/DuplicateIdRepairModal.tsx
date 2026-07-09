import { useState } from "react";
import type { DuplicateRepairPlan } from "../../core/duplicate-task-repair";
import { apiClient } from "../lib/api";
import Modal from "./Modal";

interface DuplicateIdRepairModalProps {
	isOpen: boolean;
	plan: DuplicateRepairPlan;
	onClose: () => void;
	onRepaired: () => Promise<void>;
}

export function DuplicateIdRepairModal({ isOpen, plan, onClose, onRepaired }: DuplicateIdRepairModalProps) {
	const [showConfirmation, setShowConfirmation] = useState(false);
	const [isRepairing, setIsRepairing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleClose = () => {
		if (isRepairing) return;
		setShowConfirmation(false);
		setError(null);
		onClose();
	};

	const handleRepair = async () => {
		setIsRepairing(true);
		setError(null);
		try {
			await apiClient.repairDuplicateTaskIds(plan.fingerprint);
			await onRepaired();
			handleClose();
		} catch (repairError) {
			setError(repairError instanceof Error ? repairError.message : "Duplicate task ID repair failed.");
		} finally {
			setIsRepairing(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Repair duplicate task IDs"
			maxWidthClass="max-w-4xl"
			disableEscapeClose={isRepairing}
		>
			<div className="space-y-5">
				<p className="text-sm text-gray-700 dark:text-gray-300">
					Backlog.md found {plan.groups.length} duplicate ID {plan.groups.length === 1 ? "group" : "groups"}. The
					repair keeps one file in each group at its current ID and assigns new incremental IDs to the others.
				</p>

				<div>
					<h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Files to rename</h3>
					<div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
						<ul className="divide-y divide-gray-200 dark:divide-gray-700">
							{plan.changes.map((change) => (
								<li key={change.sourcePath} className="space-y-1 px-4 py-3">
									<div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
										<span className="font-mono">{change.oldId}</span>
										<span aria-hidden="true">→</span>
										<span className="font-mono text-blue-700 dark:text-blue-300">{change.newId}</span>
										<span className="truncate text-gray-600 dark:text-gray-400">{change.title}</span>
									</div>
									<p className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">{change.sourcePath}</p>
									<p className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">{change.targetPath}</p>
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
					<h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
						References requiring review: {plan.references.length}
					</h3>
					<p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
						References are not changed automatically because an old duplicate ID does not identify which task was meant.
					</p>
					{plan.references.length > 0 && (
						<ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-amber-950 dark:text-amber-100">
							{plan.references.map((reference) => (
								<li key={`${reference.path}:${reference.line}`}>
									<p className="font-mono">{reference.path}:{reference.line}</p>
									{reference.text && <p className="truncate text-amber-800 dark:text-amber-300">{reference.text}</p>}
								</li>
							))}
						</ul>
					)}
				</div>

				{plan.blockedReasons.length > 0 && (
					<div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
						<h3 className="text-sm font-semibold text-red-900 dark:text-red-100">Automatic repair is blocked</h3>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800 dark:text-red-200">
							{plan.blockedReasons.map((reason) => (
								<li key={reason}>{reason}</li>
							))}
						</ul>
					</div>
				)}

				{showConfirmation && plan.repairable && (
					<div className="rounded-md border border-amber-300 bg-amber-100 p-4 dark:border-amber-700 dark:bg-amber-900/30">
						<h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Confirm repair</h3>
						<p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
							Rename {plan.changes.length} task {plan.changes.length === 1 ? "file" : "files"} now? Task content is
							preserved; only each selected filename and frontmatter ID change.
						</p>
					</div>
				)}

				{error && (
					<div role="alert" className="rounded-md bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
						{error}
					</div>
				)}

				<div className="flex justify-end gap-3">
					<button
						type="button"
						onClick={handleClose}
						disabled={isRepairing}
						className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
					>
						Cancel
					</button>
					{plan.repairable && !showConfirmation && (
						<button
							type="button"
							onClick={() => setShowConfirmation(true)}
							className="rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
						>
							Continue
						</button>
					)}
					{plan.repairable && showConfirmation && (
						<button
							type="button"
							onClick={handleRepair}
							disabled={isRepairing}
							className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400"
						>
							{isRepairing ? "Repairing…" : `Repair ${plan.changes.length} ${plan.changes.length === 1 ? "file" : "files"}`}
						</button>
					)}
				</div>
			</div>
		</Modal>
	);
}
