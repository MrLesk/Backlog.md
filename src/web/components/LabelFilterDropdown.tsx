import { useEffect, useRef, useState } from "react";

interface LabelFilterDropdownProps {
	availableLabels: string[];
	selectedLabels: string[];
	onChange: (labels: string[]) => void;
	menuId: string;
	className?: string;
}

export default function LabelFilterDropdown({
	availableLabels,
	selectedLabels,
	onChange,
	menuId,
	className = "min-w-[200px]",
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

	return (
		<div className="relative">
			<button
				type="button"
				ref={buttonRef}
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-controls={menuId}
				className={`${className} py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200 text-left`}
			>
				<div className="flex items-center justify-between gap-2">
					<span>Labels</span>
					<span className="text-xs text-gray-500 dark:text-gray-400">
						{selectedLabels.length === 0
							? "All"
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
					className="absolute z-50 mt-2 w-[220px] max-h-56 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
				>
					{availableLabels.length === 0 ? (
						<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No labels</div>
					) : (
						availableLabels.map((label) => {
							const isSelected = selectedLabels.includes(label);
							return (
								<label
									key={label}
									className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
								>
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => toggleLabel(label)}
										className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
									/>
									<span className="truncate">{label}</span>
								</label>
							);
						})
					)}
					{selectedLabels.length > 0 && (
						<button
							type="button"
							className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-t border-gray-200 dark:border-gray-700"
							onClick={() => {
								onChange([]);
								setIsOpen(false);
							}}
						>
							Clear label filter
						</button>
					)}
				</div>
			)}
		</div>
	);
}
