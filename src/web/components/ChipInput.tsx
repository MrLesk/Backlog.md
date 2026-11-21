import React, { useState, type KeyboardEvent } from 'react';

interface ChipInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label: string;
  name: string;
  disabled?: boolean;
  /** Known values offered as the user types, e.g. the configured label list. */
  suggestions?: string[];
}

const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, placeholder, label, name, disabled, suggestions = [] }) => {
  const [inputValue, setInputValue] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const inputId = `chip-input-${name}`;
  const listId = `${inputId}-suggestions`;
  const trimmed = inputValue.trim();

  const matches = trimmed && !disabled && !dismissed
    ? suggestions.filter((option) => {
        const key = option.trim().toLowerCase();
        return key.includes(trimmed.toLowerCase()) && !value.some((item) => item.trim().toLowerCase() === key);
      })
    : [];
  const hasSuggestions = matches.length > 0;

  const add = (next: string) => {
    const cleaned = next.trim();
    if (cleaned && !value.some((item) => item.trim().toLowerCase() === cleaned.toLowerCase())) {
      onChange([...value, cleaned]);
    }
    setInputValue('');
    setHighlighted(0);
    setDismissed(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' && hasSuggestions) {
      e.preventDefault();
      setHighlighted((index) => (index + 1) % matches.length);
      return;
    }
    if (e.key === 'ArrowUp' && hasSuggestions) {
      e.preventDefault();
      setHighlighted((index) => (index - 1 + matches.length) % matches.length);
      return;
    }
    if (e.key === 'Escape' && hasSuggestions) {
      e.preventDefault();
      setDismissed(true);
      return;
    }
    if ((e.key === 'Enter' || e.key === ',') && trimmed) {
      e.preventDefault();
      // Enter takes the highlighted suggestion; a typed comma keeps free-text entry.
      add(e.key === 'Enter' && hasSuggestions ? (matches[highlighted] ?? trimmed) : trimmed);
      return;
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last chip when backspace is pressed on empty input
      onChange(value.slice(0, -1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newValue = e.target.value;
    setDismissed(false);
    setHighlighted(0);
    if (newValue.endsWith(',')) {
      add(newValue.slice(0, -1));
    } else {
      setInputValue(newValue);
    }
  };

  const removeChip = (index: number) => {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
        {label}
      </label>
      <div className={`relative w-full min-h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400 focus-within:border-transparent transition-colors duration-200 pr-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
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
	                  aria-label={`Remove ${item}`}
	                >
	                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
	                    <path
	                      fillRule="evenodd"
	                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293-4.293a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
	                      clipRule="evenodd"
	                    />
	                  </svg>
	                </button>
              )}
            </span>
          ))}
          <input
            id={inputId}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[2ch] outline-none text-sm bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            disabled={disabled}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={hasSuggestions}
            aria-controls={listId}
          />
        </div>
        {hasSuggestions && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-lg"
          >
            {matches.map((option, index) => (
              <li key={option} role="option" aria-selected={index === highlighted}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(option)}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    index === highlighted
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ChipInput;
