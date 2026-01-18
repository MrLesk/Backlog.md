import React, { useEffect, useRef, useState } from "react";
import { type AcceptanceCriterion } from "../../types";

interface Props {
  criteria: AcceptanceCriterion[];
  onChange: (criteria: AcceptanceCriterion[]) => void;
  label?: string;
  preserveIndices?: boolean;
  disableToggle?: boolean;
}

const AcceptanceCriteriaEditor: React.FC<Props> = ({
  criteria: initial,
  onChange,
  label = "Acceptance Criteria",
  preserveIndices = false,
  disableToggle = false,
}) => {
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(initial || []);
  const [newCriterion, setNewCriterion] = useState("");

  // Refs to auto-resize textareas
  const itemRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const newRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCriteria(initial || []);
  }, [initial]);

  // Auto-resize helper
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Resize when criteria change (e.g., initial load or edits)
  useEffect(() => {
    Object.values(itemRefs.current).forEach((el) => autoResize(el));
  }, [criteria]);

  // Resize new criterion textarea when text changes
  useEffect(() => {
    autoResize(newRef.current);
  }, [newCriterion]);

  const handleToggle = (index: number, checked: boolean) => {
    if (disableToggle) return;
    const updated = criteria.map((c) => (c.index === index ? { ...c, checked } : c));
    setCriteria(updated);
    onChange(updated);
  };

  const handleTextChange = (index: number, text: string) => {
    const updated = criteria.map((c) => (c.index === index ? { ...c, text } : c));
    setCriteria(updated);
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const filtered = criteria.filter((c) => c.index !== index);
    const updated = preserveIndices ? filtered : filtered.map((c, i) => ({ ...c, index: i + 1 }));
    setCriteria(updated);
    onChange(updated);
  };

  const handleAdd = () => {
    const text = newCriterion.trim();
    if (!text) return;
    const nextIndex = preserveIndices
      ? Math.max(0, ...criteria.map((item) => item.index)) + 1
      : criteria.length + 1;
    const updated = [...criteria, { checked: false, text, index: nextIndex }];
    setCriteria(updated);
    setNewCriterion("");
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
        {label}
      </label>
      <ul className="space-y-2">
        {criteria.map((c) => (
          <li key={c.index} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={c.checked}
              onChange={(e) => handleToggle(c.index, e.target.checked)}
              disabled={disableToggle}
            />
            <textarea
              ref={(el) => { itemRefs.current[c.index] = el; }}
              rows={1}
              value={c.text}
              onChange={(e) => handleTextChange(c.index, e.target.value)}
              onInput={(e) => autoResize(e.currentTarget)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 resize-none overflow-hidden leading-5"
            />
            <button
              type="button"
              onClick={() => handleRemove(c.index)}
              className="px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <textarea
            ref={newRef}
            rows={1}
            value={newCriterion}
            onChange={(e) => setNewCriterion(e.target.value)}
            onInput={(e) => autoResize(e.currentTarget)}
            placeholder="New criterion"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 resize-none overflow-hidden leading-5"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="px-2 py-1 text-sm bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors duration-200"
          >
            Add
          </button>
        </li>
      </ul>
    </div>
  );
};

export default AcceptanceCriteriaEditor;
