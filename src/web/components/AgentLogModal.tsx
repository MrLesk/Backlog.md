import React, { useEffect, useRef, useState } from 'react';

interface AgentLogModalProps {
  taskId: string;
  taskTitle: string;
  status: string;
  agentName: string;
  onClose: () => void;
}

interface LogData {
  content: string;
  done: boolean;
  logFile: string;
}

export const AgentLogModal: React.FC<AgentLogModalProps> = ({
  taskId, taskTitle, status, agentName, onClose,
}) => {
  const [data, setData] = useState<LogData>({ content: 'Loading…', done: false, logFile: '' });
  const bottomRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/agent-log?taskId=${encodeURIComponent(taskId)}&status=${encodeURIComponent(status)}`
        );
        if (!res.ok || cancelled) return;
        const next: LogData = await res.json();
        setData(next);
      } catch { /* network error — keep showing last content */ }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [taskId, status]);

  // Auto-scroll to bottom when content changes, unless user scrolled up.
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [data.content, autoScroll]);

  const handleScroll = () => {
    const el = preRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const phaseLabel = status === 'In Progress' ? 'coder' : status === 'In Review' ? 'reviewer' : 'notifier';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl h-[78vh] bg-gray-950 rounded-xl shadow-2xl border border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Live indicator */}
            {data.done
              ? <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" title="completed" />
              : <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" title="running" />
            }
            <span className="text-sm font-mono font-medium text-gray-100 truncate">{agentName}</span>
            <span className="text-gray-600 shrink-0">·</span>
            <span className="text-xs text-gray-400 shrink-0">{phaseLabel}</span>
            <span className="text-gray-600 shrink-0">·</span>
            <span className="text-xs text-gray-500 truncate" title={taskTitle}>{taskId}</span>
            <span className="text-gray-600 shrink-0">·</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
              data.done
                ? 'bg-gray-700 text-gray-400'
                : 'bg-green-900/60 text-green-300'
            }`}>
              {data.done ? 'done' : 'live'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 text-xl leading-none ml-4 shrink-0 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Log filename ── */}
        {data.logFile && (
          <div className="px-4 py-1 bg-gray-900/50 border-b border-gray-800 text-[10px] font-mono text-gray-600 truncate shrink-0">
            {data.logFile}
          </div>
        )}

        {/* ── Log content ── */}
        <pre
          ref={preRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 text-xs font-mono text-green-300 whitespace-pre-wrap break-words leading-relaxed"
        >
          {data.content || '(no output yet)'}
          <div ref={bottomRef} />
        </pre>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/70 border-t border-gray-800 shrink-0">
          <span className="text-[10px] text-gray-600">
            {data.done ? 'Process exited' : 'Polling every 2 s — '}
            {!data.done && !autoScroll && (
              <button
                onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className="text-green-500 hover:text-green-300 underline ml-1"
              >
                scroll to bottom
              </button>
            )}
          </span>
          <span className="text-[10px] text-gray-600">Esc to close</span>
        </div>
      </div>
    </div>
  );
};
