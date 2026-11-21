import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface ChipInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label: string;
  name: string;
  disabled?: boolean;
  suggestions?: string[];
}

const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, placeholder, label, name, disabled, suggestions }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeOptionRef = useRef<HTMLLIElement>(null);
  const inputId = `chip-input-${name}`;
  const listId = `${inputId}-options`;
  const query = inputValue.trim().toLowerCase();
  const sameChip = (left: string, right: string) => suggestions
    ? left.trim().toLowerCase() === right.trim().toLowerCase()
    : left === right;
  const isSelected = (item: string) => value.some((chip) => sameChip(chip, item));
  const matches = query && suggestions
    ? suggestions.filter((item) => item.toLowerCase().includes(query) && !isSelected(item))
    : [];
  const expanded = !disabled && showSuggestions && matches.length > 0;
  const activeSuggestion = expanded ? matches[activeIndex] : undefined;

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeSuggestion]);

  const closeSuggestions = () => {
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const addValue = (text: string) => {
    const typed = text.trim();
    const chip = suggestions?.find((item) => sameChip(item, typed))?.trim() ?? typed;
    if (chip && !isSelected(chip)) onChange([...value, chip]);
    setInputValue('');
    closeSuggestions();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || e.nativeEvent.isComposing) return;
    if (matches.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setShowSuggestions(true);
      if (e.key === 'ArrowDown') {
        setActiveIndex((activeIndex + 1) % matches.length);
      } else {
        setActiveIndex(activeIndex <= 0 ? matches.length - 1 : activeIndex - 1);
      }
    } else if (expanded && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSuggestions();
    } else if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      addValue(e.key === 'Enter' && activeSuggestion ? activeSuggestion : inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const text = e.target.value;
    if (text.endsWith(',')) {
      addValue(text.slice(0, -1));
    } else {
      setInputValue(text);
      setActiveIndex(-1);
      setShowSuggestions(true);
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
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
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
            role={suggestions ? 'combobox' : undefined}
            aria-label={label || name}
            aria-autocomplete={suggestions ? 'list' : undefined}
            aria-expanded={suggestions ? expanded : undefined}
            aria-controls={expanded ? listId : undefined}
            aria-activedescendant={activeSuggestion ? `${listId}-${activeIndex}` : undefined}
            onFocus={() => setShowSuggestions(true)}
            onBlur={closeSuggestions}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[2ch] outline-none text-sm bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            disabled={disabled}
          />
        </div>
        {expanded && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label || name}
            className="absolute left-0 top-full z-10 mt-1 w-full max-h-48 overflow-y-auto overscroll-contain rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {matches.map((item, index) => (
              <li
                key={item}
                id={`${listId}-${index}`}
                ref={index === activeIndex ? activeOptionRef : undefined}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addValue(item)}
                className={`cursor-pointer px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 ${index === activeIndex ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ChipInput;
