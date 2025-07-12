import React, { useState, type KeyboardEvent } from 'react';

interface ChipInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label: string;
  name: string;
}

const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, placeholder, label, name }) => {
  const [inputValue, setInputValue] = useState('');
  const inputId = `chip-input-${name}`;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      const newValue = inputValue.trim();
      if (!value.includes(newValue)) {
        onChange([...value, newValue]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last chip when backspace is pressed on empty input
      onChange(value.slice(0, -1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Check if user typed a comma
    if (newValue.endsWith(',')) {
      const chipValue = newValue.slice(0, -1).trim();
      if (chipValue && !value.includes(chipValue)) {
        onChange([...value, chipValue]);
        setInputValue('');
      } else {
        setInputValue('');
      }
    } else {
      setInputValue(newValue);
    }
  };

  const removeChip = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden">
        <div className="flex gap-2 items-center h-full w-full overflow-x-auto scrollbar-hide">
          {value.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-blue-100 text-blue-800 rounded-md flex-shrink-0"
            >
              {item}
              <button
                type="button"
                onClick={() => removeChip(index)}
                className="hover:bg-blue-200 rounded-sm p-0.5 transition-colors cursor-pointer"
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
            </span>
          ))}
          <input
            id={inputId}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};

export default ChipInput;