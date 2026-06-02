import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../hooks/useI18n';

interface ChipInputProps {
	value: string[];
	onChange: (values: string[]) => void;
	placeholder?: string;
	label: string;
	name: string;
	disabled?: boolean;
	availableOptions?: string[];
}

function fuzzyMatch(query: string, target: string): boolean {
	const lowerQuery = query.toLowerCase();
	const lowerTarget = target.toLowerCase();
	let targetIndex = 0;
	for (let i = 0; i < lowerQuery.length; i++) {
		const char = lowerQuery[i]!;
		const foundIndex = lowerTarget.indexOf(char, targetIndex);
		if (foundIndex === -1) return false;
		targetIndex = foundIndex + 1;
	}
	return true;
}

const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, placeholder, label, name, disabled, availableOptions = [] }) => {
	const { t } = useI18n();
	const [inputValue, setInputValue] = useState('');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const inputId = `chip-input-${name}`;
	const containerRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Filter available options that are not already selected (case-insensitive) and match fuzzy search
	const existingLower = value.map((v) => v.toLowerCase());
	const filteredOptions = availableOptions.filter((option) => {
		if (existingLower.includes(option.toLowerCase())) return false;
		if (!inputValue.trim()) return true;
		return fuzzyMatch(inputValue, option);
	});

	// Find already-selected labels that fuzzy-match the current input
	const matchedExisting = inputValue.trim()
		? value.filter((v) => fuzzyMatch(inputValue, v))
		: [];

	// Check if input is a case-insensitive duplicate of an existing value
	const isDuplicate = (newValue: string): boolean => {
		return value.some((v) => v.toLowerCase() === newValue.toLowerCase());
	};

	const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

	const addChip = (chipValue: string) => {
		const trimmed = chipValue.trim();
		if (!trimmed) return;
		if (isDuplicate(trimmed)) {
			setShowDuplicateWarning(true);
			setTimeout(() => setShowDuplicateWarning(false), 1500);
			return;
		}
		onChange([...value, trimmed]);
		setInputValue('');
		setIsDropdownOpen(false);
		setHighlightedIndex(-1);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (disabled) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!isDropdownOpen) {
				setIsDropdownOpen(true);
			}
			if (filteredOptions.length > 0) {
				setHighlightedIndex((prev) => {
					if (prev < 0) return 0;
					return (prev + 1) % filteredOptions.length;
				});
			}
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (isDropdownOpen && filteredOptions.length > 0) {
				setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
			}
			return;
		}

		if (e.key === 'Escape') {
			if (isDropdownOpen) {
				e.preventDefault();
				setIsDropdownOpen(false);
				setHighlightedIndex(-1);
			}
			return;
		}

		if (e.key === 'Enter') {
			if (isDropdownOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
				e.preventDefault();
				addChip(filteredOptions[highlightedIndex]);
				return;
			}
			if (inputValue.trim()) {
				e.preventDefault();
				addChip(inputValue);
			}
			return;
		}

		if (e.key === ',' && inputValue.trim()) {
			e.preventDefault();
			addChip(inputValue);
			return;
		}

		if (e.key === 'Backspace' && !inputValue && value.length > 0) {
			onChange(value.slice(0, -1));
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) return;
		const newValue = e.target.value;
		// Check if user typed a comma
		if (newValue.endsWith(',')) {
			const chipValue = newValue.slice(0, -1).trim();
			if (chipValue) {
				addChip(chipValue);
			} else {
				setInputValue('');
			}
		} else {
			setInputValue(newValue);
			if (availableOptions.length > 0) {
				setIsDropdownOpen(true);
				setHighlightedIndex(-1);
			}
		}
	};

	const removeChip = (index: number) => {
		if (disabled) return;
		onChange(value.filter((_, i) => i !== index));
	};

	const handleFocus = () => {
		if (!disabled && availableOptions.length > 0) {
			setIsDropdownOpen(true);
			setHighlightedIndex(-1);
		}
	};

	const handleOptionClick = (option: string) => {
		addChip(option);
		inputRef.current?.focus();
	};

	// Close dropdown on outside click
	useEffect(() => {
		if (!isDropdownOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				containerRef.current &&
				!containerRef.current.contains(target) &&
				dropdownRef.current &&
				!dropdownRef.current.contains(target)
			) {
				setIsDropdownOpen(false);
				setHighlightedIndex(-1);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isDropdownOpen]);

	const hasOptions = availableOptions.length > 0;
	const showDropdown = isDropdownOpen && hasOptions;

	return (
		<div className="w-full relative" ref={containerRef}>
			<label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
				{label}
			</label>
			<div
				className={`relative w-full min-h-10 px-3 py-2 border bg-white dark:bg-gray-800 rounded-md focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400 focus-within:border-transparent transition-colors duration-200 pr-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${showDuplicateWarning ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400 dark:ring-red-500' : 'border-gray-300 dark:border-gray-600'}`}
			>
				<div className="flex flex-wrap gap-2 items-center w-full">
					{value.map((item, index) => (
						<span
							key={index}
							className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-md flex-shrink-0 min-w-0 max-w-full transition-colors duration-200"
						>
							<span className="truncate max-w-[16rem] sm:max-w-[20rem] md:max-w-[24rem]">{item}</span>
							{!disabled && (
								<button
									type="button"
									onClick={() => removeChip(index)}
									className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-sm p-0.5 transition-colors duration-200"
									aria-label={t.common.removeItem(item)}
								>
									<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
											clipRule="evenodd"
										/>
									</svg>
								</button>
							)}
						</span>
					))}
					<input
						ref={inputRef}
						id={inputId}
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						onFocus={handleFocus}
						placeholder={value.length === 0 ? placeholder : ''}
						className="flex-1 min-w-[2ch] outline-none text-sm bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
						disabled={disabled}
					/>
				</div>
			</div>
			{showDropdown && (
				<div
					ref={dropdownRef}
					className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-y-auto"
				>
					{filteredOptions.length > 0 && (
						filteredOptions.map((option, index) => (
							<button
								type="button"
								key={option}
								onClick={() => handleOptionClick(option)}
								className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${
									index === highlightedIndex
										? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
										: 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
								}`}
							>
								{option}
							</button>
						))
					)}
					{matchedExisting.length > 0 && (
						<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
							{matchedExisting.map((label) => (
								<div key={label}>
									<span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
									{' '}already added
								</div>
							))}
						</div>
					)}
					{filteredOptions.length === 0 && matchedExisting.length === 0 && (
						<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
							{inputValue.trim()
								? 'No matching labels — press Enter to create'
								: 'All labels have been added'}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default ChipInput;
