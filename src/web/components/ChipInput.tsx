import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface ChipInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label: string;
  name: string;
  disabled?: boolean;
  suggestions?: string[];
  /** Shows the field's frame at all times, as the dialog that creates a task does; elsewhere it shows on hover and focus. */
  framed?: boolean;
}

const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, placeholder, label, name, disabled, suggestions, framed = false }) => {
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

  // A quiet field, as the property values beside it: its frame shows on hover and focus. The property list names it
  // on screen, so its own label is for screen readers only.
  return (
    <div className="w-full">
      <label htmlFor={inputId} className="sr-only">
        {label || name}
      </label>
      <div className={`relative -ml-2 w-[calc(100%+0.5rem)] compact-control border px-2 py-0.5 outline-accent-strong transition-colors duration-200 hover:border-line focus-within:border-line focus-within:bg-surface has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 ${framed ? 'border-line bg-surface' : 'border-transparent'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <div className="flex w-full flex-wrap items-center gap-1">
          {value.map((item, index) => (
            <span
              key={index}
              className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-0.5 rounded-chip bg-surface-2 py-0.5 pr-0.5 pl-1.5 text-xs font-medium text-ink-2"
            >
              <span className="truncate">{item}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeChip(index)}
                  className="rounded-[3px] p-0.5 text-ink-3 transition-colors duration-200 hover:bg-hover hover:text-ink focus-ring"
                  aria-label={`Remove ${item}`}
                >
                  <svg className="size-3" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </span>
          ))}
          <input
            id={inputId}
            type="text"
            role={suggestions ? 'combobox' : undefined}
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
            className="min-w-[2ch] flex-1 bg-transparent text-sm font-normal text-ink outline-none placeholder:font-mono placeholder:text-xs placeholder:text-ink-3"
            disabled={disabled}
          />
        </div>
        {expanded && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label || name}
            className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto overscroll-contain rounded-control border border-line bg-surface py-1 shadow-lg"
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
                className={`cursor-pointer px-3 py-1.5 text-sm font-normal text-ink hover:bg-hover ${index === activeIndex ? 'bg-surface-2' : ''}`}
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
