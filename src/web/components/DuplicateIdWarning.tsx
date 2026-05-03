import { useState } from "react";
import type { DuplicateGroup } from "../../utils/duplicate-detection";
import { buildDuplicateCleanupPrompt } from "../../utils/duplicate-detection";

interface DuplicateIdWarningProps {
	groups: DuplicateGroup[];
}

export function DuplicateIdWarning({ groups }: DuplicateIdWarningProps) {
	const [dismissed, setDismissed] = useState(false);
	const [copied, setCopied] = useState(false);

	if (dismissed || groups.length === 0) return null;

	const handleCopyPrompt = () => {
		const prompt = buildDuplicateCleanupPrompt(groups);
		navigator.clipboard.writeText(prompt).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	return (
		<div className="fixed top-0 left-0 right-0 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm shadow-lg z-50 animate-slide-in-down">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 font-medium mb-1">
						<span>⚠️</span>
						<span>Duplicate task IDs detected ({groups.length} {groups.length === 1 ? "group" : "groups"})</span>
					</div>
					<ul className="list-none space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
						{groups.map((group) => (
							<li key={group.id}>
								<span className="font-mono font-semibold">{group.id}</span>
								{": "}
								{group.tasks.map((t) => `"${t.title}"`).join(" · ")}
							</li>
						))}
					</ul>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					<button
						onClick={handleCopyPrompt}
						className="px-3 py-1.5 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 rounded text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500 whitespace-nowrap"
						title="Copy an AI prompt to help fix these duplicates"
					>
						{copied ? "Copied!" : "Copy AI fix prompt"}
					</button>
					<button
						onClick={() => setDismissed(true)}
						className="px-3 py-1.5 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 rounded text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500"
						aria-label="Dismiss warning"
					>
						Dismiss
					</button>
				</div>
			</div>
		</div>
	);
}
