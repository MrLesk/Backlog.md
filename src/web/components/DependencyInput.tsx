import React, { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { type Task } from '../../types';
import { buildTaskIdIndex, resolveTaskReference } from '../utils/task-id-links';

const CHIP_LABEL_CLASS = 'truncate max-w-[16rem] sm:max-w-[20rem] md:max-w-[24rem]';

// Chip links open the task detail in place, mirroring App's handleEditTask navigation:
// stay on the board when reading from it (canonical /tasks everywhere else, which also
// keeps external deep links working), carry the page's query string so URL-backed
// filters survive, and replace an already-open task route while preserving its
// original taskModalFrom return context so closing the target does not walk back
// through this task. Kept as a subcomponent so the router context is only required
// where a link actually renders, and so PR #960's useTaskHref hook can replace the
// derivation once it lands.
const TaskChipLink: React.FC<{ taskId: string; display: string }> = ({ taskId, display }) => {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/board')
    ? '/board'
    : location.pathname.startsWith('/tasks')
      ? '/tasks'
      : null;
  const search = basePath ? location.search : '';
  const isReplacingTaskRoute = basePath !== null && location.pathname.startsWith(`${basePath}/`);
  const currentTaskModalFrom =
    location.state && typeof location.state === 'object'
      ? (location.state as { taskModalFrom?: string }).taskModalFrom
      : undefined;
  const taskModalFrom = isReplacingTaskRoute ? currentTaskModalFrom : basePath ? `${basePath}${search}` : undefined;
  return (
    <Link
      to={`${basePath ?? '/tasks'}/${taskId}${search}`}
      replace={isReplacingTaskRoute}
      state={taskModalFrom ? { taskModalFrom } : undefined}
      className={`${CHIP_LABEL_CLASS} hover:underline`}
      title={display}
    >
      {display}
    </Link>
  );
};

interface DependencyInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  availableTasks: Task[];
  // Tasks the server will actually accept as a dependency (the local working copy). Defaults to
  // availableTasks so callers with no cross-branch corpus keep suggesting everything they show.
  suggestableTasks?: Task[];
  currentTaskId?: string;
  label?: string; // optional label; render only if provided
  disabled?: boolean;
}

const DependencyInput: React.FC<DependencyInputProps> = ({ value, onChange, availableTasks, suggestableTasks, currentTaskId, label = 'Dependencies', disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = 'dependency-input';
  const suggestionSource = suggestableTasks ?? availableTasks;

  // Resolve chips through the same canonical identity the markdown auto-links use, so
  // case and zero-padding differences still resolve and ambiguous IDs stay unlinked
  const taskIdIndex = useMemo(() => buildTaskIdIndex(availableTasks), [availableTasks]);
  const resolveDependency = (taskId: string) => resolveTaskReference(taskIdIndex, taskId);

  // Filter tasks based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestionSource.filter(task =>
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
  }, [inputValue, suggestionSource, value, currentTaskId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const addDependency = (taskId: string) => {
    if (disabled) return;
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
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      if (suggestions.length > 0 && suggestions[selectedIndex]) {
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
    if (disabled) return;
    const newValue = e.target.value;
    // Check if user typed a comma
    if (newValue.endsWith(',')) {
      const searchValue = newValue.slice(0, -1).trim();
      if (searchValue && suggestions.length > 0 && suggestions[selectedIndex]) {
        addDependency(suggestions[selectedIndex].id);
      }
    } else {
      setInputValue(newValue);
    }
  };

  return (
    <div>
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
          {label}
        </label>
      ) : null}
      <div className="relative w-full">
        <div className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400 focus-within:border-transparent transition-colors duration-200 max-h-60 overflow-auto pr-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
          {/* Display selected dependencies */}
          {value.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {value.map((taskId, index) => {
                const dependency = resolveDependency(taskId);
                const display = dependency ? `${dependency.id} - ${dependency.title}` : taskId;
                return (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-md transition-colors duration-200 min-w-0 max-w-full"
                >
                  {dependency ? (
                    <TaskChipLink taskId={dependency.id} display={display} />
                  ) : (
                    <span className={CHIP_LABEL_CLASS} title={display}>{display}</span>
                  )}
	                  {!disabled && (
	                    <button
	                      type="button"
	                      onClick={() => removeDependency(index)}
	                      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-sm p-0.5 transition-colors duration-200"
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
                  )}
                </span>
                );
              })}
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
            className="w-full outline-none text-sm bg-transparent resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            rows={1}
            disabled={disabled}
          />
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-64 overflow-auto overscroll-contain transition-colors duration-200">
	            {suggestions.map((task, index) => (
	              <button
	                key={task.id}
	                type="button"
	                onClick={() => addDependency(task.id)}
	                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ${
	                  index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
	                }`}
	              >
                <div className="font-medium text-gray-900 dark:text-white">{task.id}</div>
                <div className="text-gray-600 dark:text-gray-300 break-words whitespace-normal">{task.title}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DependencyInput;
