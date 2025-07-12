import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { type Task } from '../../types';

interface DependencyInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  availableTasks: Task[];
  currentTaskId?: string;
}

const DependencyInput: React.FC<DependencyInputProps> = ({ value, onChange, availableTasks, currentTaskId }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = 'dependency-input';

  // Get task display text
  const getTaskDisplay = (taskId: string) => {
    const task = availableTasks.find(t => t.id === taskId);
    return task ? `${task.id} - ${task.title}` : taskId;
  };

  // Filter tasks based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = availableTasks.filter(task => 
        task.id !== currentTaskId && // Don't suggest current task
        !value.includes(task.id) && // Don't suggest already added tasks
        (task.id.toLowerCase().includes(inputValue.toLowerCase()) ||
         task.title.toLowerCase().includes(inputValue.toLowerCase()))
      );
      setSuggestions(filtered);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  }, [inputValue, availableTasks, value, currentTaskId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const addDependency = (taskId: string) => {
    if (!value.includes(taskId)) {
      onChange([...value, taskId]);
      setInputValue('');
      setSuggestions([]);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const removeDependency = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      if (suggestions.length > 0) {
        addDependency(suggestions[selectedIndex].id);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last dependency when backspace on empty input
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setInputValue('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Check if user typed a comma
    if (newValue.endsWith(',')) {
      const searchValue = newValue.slice(0, -1).trim();
      if (searchValue && suggestions.length > 0) {
        addDependency(suggestions[selectedIndex].id);
      }
    } else {
      setInputValue(newValue);
    }
  };

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        Dependencies
      </label>
      <div className="relative w-full">
        <div className="w-full min-h-10 px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          {/* Display selected dependencies */}
          {value.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {value.map((taskId, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-blue-100 text-blue-800 rounded-md"
                >
                  <span className="max-w-xs truncate">{getTaskDisplay(taskId)}</span>
                  <button
                    type="button"
                    onClick={() => removeDependency(index)}
                    className="hover:bg-blue-200 rounded-sm p-0.5 transition-colors"
                    aria-label={`Remove ${taskId}`}
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
            </div>
          )}
          
          {/* Input field */}
          <textarea
            ref={textareaRef}
            id={inputId}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? "Type task ID or title, then press Enter or comma" : "Add more dependencies..."}
            className="w-full outline-none text-sm bg-transparent resize-none"
            rows={1}
          />
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((task, index) => (
              <button
                key={task.id}
                type="button"
                onClick={() => addDependency(task.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                  index === selectedIndex ? 'bg-gray-100' : ''
                }`}
              >
                <div className="font-medium">{task.id}</div>
                <div className="text-gray-600 truncate">{task.title}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DependencyInput;