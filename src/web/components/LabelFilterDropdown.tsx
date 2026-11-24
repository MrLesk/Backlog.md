import { type KeyboardEvent, useEffect, useRef, useState } from "react";

interface LabelFilterDropdownProps {
	availableLabels: string[];
	selectedLabels: string[];
	onChange: (labels: string[]) => void;
	menuId: string;
	className?: string;
	label?: string;
	emptyLabel?: string;
	noOptionsLabel?: string;
	clearLabel?: string;
}

/** A button that opens a checkbox list for choosing several values, such as labels or statuses. */
export default function LabelFilterDropdown({
	availableLabels,
	selectedLabels,
	onChange,
	menuId,
	className = "min-w-[200px]",
	label = "Labels",
	emptyLabel = "All",
	noOptionsLabel = "No labels",
	clearLabel = "Clear label filter",
}: LabelFilterDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				buttonRef.current &&
				menuRef.current &&
				!buttonRef.current.contains(target) &&
				!menuRef.current.contains(target)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const toggleLabel = (label: string) => {
		const next = selectedLabels.includes(label)
			? selectedLabels.filter((item) => item !== label)
			: [...selectedLabels, label];
		onChange(next);
	};

	// Escape closes the list and returns focus to the button, so keyboard users never leave an open list behind.
	const closeOnEscape = (event: KeyboardEvent) => {
		if (event.key !== "Escape" || !isOpen) return;
		event.stopPropagation();
		setIsOpen(false);
		buttonRef.current?.focus();
	};

	return (
		<div className="relative" onKeyDown={closeOnEscape}>
			<button
				type="button"
				ref={buttonRef}
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-controls={menuId}
				className={`${className} h-8 rounded-control border border-line bg-surface px-2.5 text-left text-sm text-ink transition-colors duration-200 hover:bg-hover focus-ring`}
			>
				<div className="flex items-center justify-between gap-2">
					<span>{label}</span>
					<span className="truncate text-xs text-ink-3">
						{selectedLabels.length === 0
							? emptyLabel
							: selectedLabels.length === 1
								? selectedLabels[0]
								: `${selectedLabels.length} selected`}
					</span>
				</div>
			</button>
			{isOpen && (
				<div
					id={menuId}
					ref={menuRef}
					className="absolute z-50 mt-1 max-h-56 w-[220px] overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-lg"
				>
					{availableLabels.length === 0 ? (
						<div className="px-3 py-2 text-sm text-ink-3">{noOptionsLabel}</div>
					) : (
						availableLabels.map((label) => {
							const isSelected = selectedLabels.includes(label);
							return (
								<label
									key={label}
									className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-hover"
								>
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => toggleLabel(label)}
										className="size-4 accent-accent-strong focus-ring"
									/>
									<span className="truncate">{label}</span>
								</label>
							);
						})
					)}
					{selectedLabels.length > 0 && (
						<button
							type="button"
							className="mt-1 w-full border-t border-line-soft px-3 py-2 text-left text-xs text-accent-text hover:bg-hover focus-ring"
							onClick={() => {
								onChange([]);
								setIsOpen(false);
							}}
						>
							{clearLabel}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
