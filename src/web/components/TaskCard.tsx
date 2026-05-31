import React from 'react';
import { type ConfigurableCardField, type Task } from '../../types';
import { useAgentStatus } from '../hooks/useAgentStatus';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onEdit: (task: Task) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  status?: string;
  laneId?: string;
  /**
   * Set of fields to suppress on this card. Always-on chrome (title,
   * branch banner/tooltip, priority border, drag visuals) is rendered
   * unconditionally and cannot be hidden via this set. See
   * src/types/index.ts CONFIGURABLE_CARD_FIELDS.
   */
  hiddenFields?: ReadonlySet<ConfigurableCardField>;
}

const EMPTY_HIDDEN: ReadonlySet<ConfigurableCardField> = new Set();

const SpinnerIcon: React.FC<{ className?: string }> = ({ className = 'w-2.5 h-2.5' }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-label="running">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const DoneIcon: React.FC<{ className?: string }> = ({ className = 'w-2.5 h-2.5' }) => (
  <svg className={`${className} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="completed">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDragStart, onDragEnd, status, laneId, hiddenFields = EMPTY_HIDDEN }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [showBranchTooltip, setShowBranchTooltip] = React.useState(false);
  const agentStatus = useAgentStatus(task.id);

  // Check if task is from another branch (read-only)
  const isFromOtherBranch = Boolean(task.branch);

  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging cross-branch tasks
    if (isFromOtherBranch) {
      e.preventDefault();
      setShowBranchTooltip(true);
      setTimeout(() => setShowBranchTooltip(false), 3000);
      return;
    }

    e.dataTransfer.setData('text/plain', task.id);
    if (status) {
      e.dataTransfer.setData('text/status', status);
    }
    if (laneId !== undefined) {
      e.dataTransfer.setData('text/lane', laneId);
    }
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const getPriorityClass = (priority?: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-red-500 dark:border-l-red-400';
      case 'medium': return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-400';
      case 'low': return 'border-l-4 border-l-green-500 dark:border-l-green-400';
      default: return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const formatRelativeDate = (dateStr: string) => {
    // Handle both date-only and datetime formats
    const hasTime = dateStr.includes(" ") || dateStr.includes("T");
    const date = new Date(dateStr.replace(" ", "T") + (hasTime ? ":00Z" : "T00:00:00Z"));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high': return { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', label: 'High' };
      case 'medium': return { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', label: 'Med' };
      case 'low': return { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: 'Low' };
      default: return null;
    }
  };

  return (
    <div className="relative">
      {/* Branch tooltip when trying to drag cross-branch task */}
      {showBranchTooltip && isFromOtherBranch && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Switch to <span className="font-semibold text-amber-300">{task.branch}</span> branch to move this task
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900 dark:bg-gray-700"></div>
        </div>
      )}

      <div
        className={`bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 mb-2 transition-all duration-200 ${
          isFromOtherBranch 
            ? 'opacity-75 cursor-not-allowed border-dashed' 
            : 'cursor-pointer hover:shadow-md dark:hover:shadow-lg hover:border-stone-500 dark:hover:border-stone-400'
        } ${getPriorityClass(task.priority)} ${
          isDragging ? 'opacity-50 transform rotate-2 scale-105' : ''
        }`}
        draggable={!isFromOtherBranch}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => onEdit(task)}
      >
        {/* Cross-branch indicator banner */}
        {isFromOtherBranch && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 -mx-1 -mt-1 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 rounded-t text-xs text-amber-700 dark:text-amber-300">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="truncate">
              From <span className="font-semibold">{task.branch}</span> branch
            </span>
          </div>
        )}

        {/* Slot: header-left (id) + header-right (priority badge).
            Container collapses when both slots are hidden so the title
            doesn't shift down by a phantom mb-1.5. */}
        {(() => {
          const showId = !hiddenFields.has('id');
          const priorityBadge = !hiddenFields.has('priority') ? getPriorityBadge(task.priority) : null;
          if (!showId && !priorityBadge) return null;
          return (
            <div className="flex items-center justify-between gap-2 mb-1.5">
              {showId ? (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono transition-colors duration-200">{task.id}</span>
              ) : (
                <span />
              )}
              {priorityBadge && (
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${priorityBadge.bg} ${priorityBadge.text} transition-colors duration-200`}>
                  {priorityBadge.label}
                </span>
              )}
            </div>
          );
        })()}

        {/* Title (always-on chrome). */}
        <h4 className={`font-semibold text-sm line-clamp-2 transition-colors duration-200 ${
          isFromOtherBranch
            ? 'text-gray-600 dark:text-gray-400'
            : 'text-gray-900 dark:text-gray-100'
        }`}>
          {task.title}
        </h4>

        {/* Slot: body-milestone — renders only when the task has a
            milestone AND the field is not hidden. Placed above labels so
            adding it doesn't displace any existing field's position. */}
        {!hiddenFields.has('milestone') && task.milestone && task.milestone.trim() !== '' && (
          <div className="mt-2">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 rounded transition-colors duration-200"
              title={`Milestone: ${task.milestone}`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5v14l4-4h11V5H5z" />
              </svg>
              <span className="truncate max-w-[140px]">{task.milestone}</span>
            </span>
          </div>
        )}

        {/* Slot: body-agent — coder + reviewer agent chips with live run state. */}
        {(!hiddenFields.has('agent') && task.agent) || (!hiddenFields.has('reviewAgent') && task.reviewAgent) ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {!hiddenFields.has('agent') && task.agent && (() => {
              const running = agentStatus.coder?.running;
              const done    = agentStatus.coder?.completed;
              return (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors duration-200 ${
                    running
                      ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200'
                      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}
                  title={`Coder agent: ${task.agent}${running ? ' (running)' : done ? ' (done)' : ''}`}
                >
                  {running ? <SpinnerIcon /> : done ? <DoneIcon /> : (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  )}
                  {task.agent}
                </span>
              );
            })()}
            {!hiddenFields.has('reviewAgent') && task.reviewAgent && (() => {
              const running = agentStatus.reviewer?.running;
              const done    = agentStatus.reviewer?.completed;
              return (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors duration-200 ${
                    running
                      ? 'bg-purple-100 dark:bg-purple-800/50 text-purple-800 dark:text-purple-200'
                      : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  }`}
                  title={`Reviewer agent: ${task.reviewAgent}${running ? ' (running)' : done ? ' (done)' : ''}`}
                >
                  {running ? <SpinnerIcon /> : done ? <DoneIcon /> : (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {task.reviewAgent}
                </span>
              );
            })()}
          </div>
        ) : null}

        {/* Slot: body-labels — limited to 3, with a "+N" overflow. */}
        {!hiddenFields.has('labels') && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.labels.slice(0, 3).map(label => (
              <span
                key={label}
                className="inline-block px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded transition-colors duration-200"
              >
                {label}
              </span>
            ))}
            {task.labels.length > 3 && (
              <span className="inline-block px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                +{task.labels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer row: createdDate (left) + first assignee (right).
            When both slots are hidden, the divider/footer collapses too
            so we don't render an empty border above blank space. */}
        {(() => {
          const showDate = !hiddenFields.has('createdDate');
          const showAssignee = !hiddenFields.has('assignee') && task.assignee.length > 0;
          if (!showDate && !showAssignee) return null;
          return (
            <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-600/50 transition-colors duration-200">
              {showDate ? <span>{formatRelativeDate(task.createdDate)}</span> : <span />}
              {showAssignee && (
                <span className="truncate max-w-[80px]" title={task.assignee.join(', ')}>
                  {task.assignee[0]}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default TaskCard;
