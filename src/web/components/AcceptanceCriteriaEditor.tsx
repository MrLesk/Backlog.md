import React, { useEffect, useRef, useState } from "react";
import { type AcceptanceCriterion } from "../../types";
import { normalizeAcceptanceCriterionText } from "../../utils/acceptance-criteria.ts";

interface Props {
  criteria: AcceptanceCriterion[];
  onChange: (criteria: AcceptanceCriterion[]) => void;
  label?: string;
  preserveIndices?: boolean;
  disableToggle?: boolean;
  singleLine?: boolean;
}

const AcceptanceCriteriaEditor: React.FC<Props> = ({
  criteria: initial,
  onChange,
  label = "Acceptance Criteria",
  preserveIndices = false,
  disableToggle = false,
  singleLine = true,
}) => {
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(initial || []);
  const [newCriterion, setNewCriterion] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const validateText = (text: string) => {
    try {
      if (singleLine) normalizeAcceptanceCriterionText(text);
      setError(null);
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (singleLine && event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      validateText(event.currentTarget.value + "\n");
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!validateText(event.clipboardData.getData("text"))) event.preventDefault();
  };

  const handleTextChange = (index: number, text: string) => {
    if (!validateText(text)) return;
    const updated = criteria.map((c) => (c.index === index ? { ...c, text } : c));
    setCriteria(updated);
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    setError(null);
    const filtered = criteria.filter((c) => c.index !== index);
    const updated = preserveIndices ? filtered : filtered.map((c, i) => ({ ...c, index: i + 1 }));
    setCriteria(updated);
    onChange(updated);
  };

  const handleAdd = () => {
    if (!validateText(newCriterion)) return;
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
    // The section around the editor shows its name; `label` names each field for screen readers.
    <div className="space-y-2">
      <ul className="space-y-2">
        {criteria.map((c) => (
          <li key={c.index} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`${label} item ${c.index} done`}
              className="shrink-0 checkbox focus-ring"
              checked={c.checked}
              onChange={(e) => handleToggle(c.index, e.target.checked)}
              disabled={disableToggle}
            />
            <textarea
              ref={(el) => { itemRefs.current[c.index] = el; }}
              rows={1}
              aria-label={`${label} item ${c.index}`}
              value={c.text}
              onChange={(e) => handleTextChange(c.index, e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onInput={(e) => autoResize(e.currentTarget)}
              className="min-w-0 flex-1 resize-none overflow-hidden rounded-control border border-line bg-surface px-2 py-1 text-sm leading-5 text-ink placeholder:text-ink-3 focus-ring"
            />
            <button
              type="button"
              onClick={() => handleRemove(c.index)}
              className="shrink-0 rounded-control px-2 py-1 text-sm text-ink-2 transition-colors duration-200 hover:bg-hover hover:text-blocked focus-ring"
            >
              Remove
            </button>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <textarea
            ref={newRef}
            rows={1}
            aria-label={`New ${label} item`}
            value={newCriterion}
            onChange={(e) => {
              if (validateText(e.target.value)) setNewCriterion(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onInput={(e) => autoResize(e.currentTarget)}
            placeholder="New criterion"
            className="min-w-0 flex-1 resize-none overflow-hidden rounded-control border border-line bg-surface px-2 py-1 text-sm leading-5 text-ink placeholder:text-ink-3 focus-ring"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="shrink-0 rounded-control border border-line bg-surface px-2.5 py-1 text-sm font-medium text-ink transition-colors duration-200 hover:bg-hover focus-ring"
          >
            Add
          </button>
        </li>
      </ul>
      {error && <p role="alert" className="text-sm text-blocked">{error}</p>}
    </div>
  );
};

export default AcceptanceCriteriaEditor;
