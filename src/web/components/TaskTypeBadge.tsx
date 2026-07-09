import type React from "react";

const TYPE_BADGE_PALETTES = [
	"bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
	"bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
	"bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
	"bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
	"bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
	"bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
	"bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
	"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
] as const;

const COMMON_TYPE_PALETTE_INDEX: Record<string, number> = {
	bug: 0,
	feature: 1,
	enhancement: 2,
	task: 3,
	chore: 4,
	docs: 5,
	spike: 6,
};

function getPaletteIndex(taskType: string, availableTypes?: string[]): number {
	const normalized = taskType.trim().toLowerCase();
	const knownIndex = COMMON_TYPE_PALETTE_INDEX[normalized];
	if (knownIndex !== undefined) {
		return knownIndex;
	}

	if (availableTypes && availableTypes.length > 0) {
		const usedKnownIndices = new Set<number>();
		const configuredCustomTypes: string[] = [];
		const seenCustomTypes = new Set<string>();
		for (const availableType of availableTypes) {
			const normalizedAvailableType = availableType.trim().toLowerCase();
			if (!normalizedAvailableType) {
				continue;
			}
			const availableKnownIndex = COMMON_TYPE_PALETTE_INDEX[normalizedAvailableType];
			if (availableKnownIndex !== undefined) {
				usedKnownIndices.add(availableKnownIndex);
			} else if (!seenCustomTypes.has(normalizedAvailableType)) {
				seenCustomTypes.add(normalizedAvailableType);
				configuredCustomTypes.push(normalizedAvailableType);
			}
		}

		const customTypeIndex = configuredCustomTypes.indexOf(normalized);
		const availablePaletteIndices = TYPE_BADGE_PALETTES.map((_, index) => index).filter(
			(index) => !usedKnownIndices.has(index),
		);
		if (customTypeIndex >= 0 && availablePaletteIndices.length > 0) {
			return availablePaletteIndices[customTypeIndex % availablePaletteIndices.length] ?? 0;
		}
	}

	let hash = 0;
	for (const character of normalized) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}
	return hash % TYPE_BADGE_PALETTES.length;
}

interface TaskTypeBadgeProps {
	type?: string;
	availableTypes?: string[];
	className?: string;
}

const TaskTypeBadge: React.FC<TaskTypeBadgeProps> = ({ type, availableTypes, className = "" }) => {
	const label = type?.trim();
	if (!label) {
		return null;
	}

	return (
		<span
			data-task-type={label}
			title={`Task type: ${label}`}
			className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ${TYPE_BADGE_PALETTES[getPaletteIndex(label, availableTypes)]} ${className}`}
		>
			<span className="truncate">{label}</span>
		</span>
	);
};

export default TaskTypeBadge;
