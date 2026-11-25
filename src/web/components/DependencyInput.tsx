import React, { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { type Task } from '../../types';
import { buildTaskIdIndex, resolveTaskReference } from '../utils/task-id-links';
import { taskLinkLabel } from '../lib/task-links';
import TaskLink from './TaskLink';

// A long title is cut to the width of the chip; the chip's tooltip holds all of it.
const CHIP_LABEL_CLASS = 'min-w-0 truncate';

interface DependencyInputProps {
  value: string[];
  onChange?: (values: string[]) => void;
  availableTasks: Task[];
  // Tasks the server will actually accept as a dependency (the local working copy). Defaults to
  // availableTasks so callers with no cross-branch corpus keep suggesting everything they show.
  suggestableTasks?: Task[];
  currentTaskId?: string;
  label?: string; // optional label; render only if provided
}

const DependencyInput: React.FC<DependencyInputProps> = ({ value, onChange, availableTasks, suggestableTasks, currentTaskId, label = 'Dependencies' }) => {
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
    if (!onChange || value.includes(taskId)) return;
    onChange([...value, taskId]);
    setInputValue('');
    setSuggestions([]);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!onChange) return;
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
    } else if (e.key === 'Escape' && suggestions.length > 0) {
      // This Escape closes the suggestions, so the page around the field does not close too.
      e.preventDefault();
      setSuggestions([]);
      setInputValue('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  if (!onChange && value.length === 0) {
    return <p className="font-mono text-xs font-normal text-ink-3">None</p>;
  }

  // A quiet field, as the property values beside it: its frame shows on hover and focus.
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={onChange ? inputId : undefined} className="mb-1 block text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <div className="relative property-field focus-within:bg-surface">
        <div className="max-h-60 overflow-auto py-0.5">
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1 py-0.5">
              {value.map((taskId, index) => {
                const dependency = resolveDependency(taskId);
                const display = dependency ? `${dependency.id} - ${dependency.title}` : taskId;
                return (
                  <span
                    key={index}
                    className="inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-chip bg-surface-2 py-0.5 pr-0.5 pl-1.5 text-xs font-medium text-ink-2"
                  >
                    {dependency ? (
                      <TaskLink
                        task={dependency}
                        title={display}
                        aria-label={taskLinkLabel(dependency)}
                        className={`${CHIP_LABEL_CLASS} rounded-[3px] hover:text-ink hover:underline focus-ring`}
                      >
                        {display}
                      </TaskLink>
                    ) : (
                      <span className={CHIP_LABEL_CLASS} title={display}>{display}</span>
                    )}
                    {onChange && (
                      <button
                        type="button"
                        onClick={() => onChange(value.filter((_, i) => i !== index))}
                        className="rounded-[3px] p-0.5 text-ink-3 transition-colors duration-200 hover:bg-hover hover:text-ink focus-ring"
                        aria-label={`Remove ${taskId}`}
                      >
                        <svg className="size-3" viewBox="0 0 16 16" aria-hidden="true">
                          <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {onChange && (
            <textarea
              ref={textareaRef}
              id={inputId}
              aria-label={label || 'Add dependency'}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={value.length === 0 ? "Add a dependency" : "Add another"}
              className="block w-full resize-none overflow-hidden bg-transparent py-0.5 text-sm font-normal text-ink outline-none placeholder:font-mono placeholder:text-xs placeholder:text-ink-3"
              rows={1}
            />
          )}
        </div>

        {onChange && suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-10 mt-1 max-h-64 w-full overflow-auto overscroll-contain rounded-control border border-line bg-surface py-1 shadow-lg">
            {suggestions.map((task, index) => (
              <button
                key={task.id}
                type="button"
                onClick={() => addDependency(task.id)}
                className={`w-full px-3 py-1.5 text-left text-sm font-normal transition-colors duration-200 hover:bg-hover ${
                  index === selectedIndex ? 'bg-surface-2' : ''
                }`}
              >
                <div className="font-mono text-xs font-medium text-ink-3">{task.id}</div>
                <div className="whitespace-normal break-words text-ink">{task.title}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DependencyInput;
