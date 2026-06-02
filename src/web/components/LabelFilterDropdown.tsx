import { useEffect, useRef, useState } from "react";
import { useI18n } from '../hooks/useI18n';
import { getLabelColorClasses, LABEL_COLOR_PRESETS } from '../utils/labelColors';

interface LabelFilterDropdownProps {
	availableLabels: string[];
	selectedLabels: string[];
	onChange: (labels: string[]) => void;
	menuId: string;
	className?: string;
	labelColors?: Record<string, string>;
	onLabelColorsChange?: (colors: Record<string, string>) => void;
}

export default function LabelFilterDropdown({
	availableLabels,
	selectedLabels,
	onChange,
	menuId,
	className = "min-w-[200px]",
	labelColors = {},
	onLabelColorsChange,
}: LabelFilterDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [pickerLabel, setPickerLabel] = useState<string | null>(null);
	const [draftColor, setDraftColor] = useState<string | null>(null);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const { t } = useI18n();

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
				setPickerLabel(null);
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

	const openPicker = (label: string) => {
		setPickerLabel(label);
		setDraftColor(labelColors[label] || null);
	};

	const closePicker = () => {
		setPickerLabel(null);
		setDraftColor(null);
	};

	const saveColor = () => {
		if (!onLabelColorsChange || !pickerLabel) return;
		const next = { ...labelColors };
		if (draftColor) {
			next[pickerLabel] = draftColor;
		} else {
			delete next[pickerLabel];
		}
		onLabelColorsChange(next);
		closePicker();
	};

	const isInPicker = pickerLabel !== null;

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
					<span>{t.labelFilter.labels}</span>
					<span className="text-xs text-gray-500 dark:text-gray-400">
						{selectedLabels.length === 0
							? t.common.all
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
					className={`absolute z-50 mt-2 w-[240px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg ${isInPicker ? '' : 'max-h-72 overflow-y-auto'}`}
				>
					{isInPicker ? (
						<div className="p-3">
							<div className="flex items-center justify-between mb-3">
								<span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-2">
									{pickerLabel}
								</span>
								<button
									type="button"
									onClick={closePicker}
									className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
									aria-label={t.common.cancel}
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							<div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
								选择颜色
							</div>
							<div className="grid grid-cols-4 gap-2 mb-3">
								{LABEL_COLOR_PRESETS.map((colorKey) => {
									const isSelected = draftColor === colorKey;
									const colorClasses = getLabelColorClasses(colorKey);
									return (
										<button
											key={colorKey}
											type="button"
											onClick={() => setDraftColor(colorKey)}
											className={`relative w-full aspect-square rounded-md ${colorClasses.bg} ${colorClasses.text} border-2 transition-all ${
												isSelected
													? 'border-gray-900 dark:border-white scale-105'
													: 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
											}`}
											title={colorKey}
										>
											{isSelected && (
												<svg
													className="absolute inset-0 m-auto w-4 h-4 text-gray-900 dark:text-white"
													fill="none"
													stroke="currentColor"
													strokeWidth={3}
													viewBox="0 0 24 24"
												>
													<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											)}
										</button>
									);
									})}
									<button
										type="button"
										onClick={() => setDraftColor(null)}
										className={`relative w-full aspect-square rounded-md bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 border-2 transition-all ${
											draftColor === null
												? 'border-gray-900 dark:border-white scale-105'
												: 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
										}`}
										title="Default"
									>
										{draftColor === null && (
											<svg
												className="absolute inset-0 m-auto w-4 h-4 text-gray-900 dark:text-white"
												fill="none"
												stroke="currentColor"
												strokeWidth={3}
												viewBox="0 0 24 24"
											>
												<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
											</svg>
										)}
									</button>
								</div>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={saveColor}
										className="flex-1 text-xs px-3 py-1.5 rounded bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
									>
										{t.common.save}
									</button>
									<button
										type="button"
										onClick={closePicker}
										className="flex-1 text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
									>
										{t.common.cancel}
									</button>
								</div>
						</div>
					) : (
						<>
							{availableLabels.length === 0 ? (
								<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t.labelFilter.noLabels}</div>
							) : (
								availableLabels.map((label) => {
									const isSelected = selectedLabels.includes(label);
									const currentColorKey = labelColors[label];
									const colorClasses = getLabelColorClasses(currentColorKey);
									return (
									<div
										key={label}
										className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
									>
										<label className="flex items-center gap-2 flex-1 cursor-pointer truncate">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleLabel(label)}
												className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 shrink-0"
											/>
											<span className="truncate">{label}</span>
										</label>
										{onLabelColorsChange && (
											<button
												type="button"
												data-swatches
												onClick={(e) => {
													e.stopPropagation();
													openPicker(label);
												}}
												className={`shrink-0 w-4 h-4 rounded-sm border border-gray-300 dark:border-gray-500 ${colorClasses.bg} transition-transform hover:scale-110`}
												title="Set color"
											/>
										)}
									</div>
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
										{t.labelFilter.clearFilter}
									</button>
								)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
