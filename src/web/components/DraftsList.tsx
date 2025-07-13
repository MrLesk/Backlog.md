import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { type Task } from '../../types';

interface DraftsListProps {
  onEditTask: (task: Task) => void;
  onNewDraft: () => void;
}

const DraftsList: React.FC<DraftsListProps> = ({ onEditTask, onNewDraft }) => {
  const [drafts, setDrafts] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      // For now, we'll filter tasks with status "Draft" since there's no separate drafts endpoint
      const allTasks = await apiClient.fetchTasks();
      const draftsData = allTasks.filter(task => task.status.toLowerCase() === 'draft');
      setDrafts(draftsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  // const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
  //   try {
  //     const updatedTask = await apiClient.updateTask(taskId, updates);
  //     setDrafts(prevDrafts => 
  //       prevDrafts.map(task => task.id === taskId ? updatedTask : task)
  //     );
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : 'Failed to update draft');
  //   }
  // };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading drafts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
        <button 
          onClick={loadDrafts}
          className="ml-4 inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 transition-colors duration-200">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Draft Tasks</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
            </div>
            <button 
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer" 
              onClick={onNewDraft}
            >
              + New Draft
            </button>
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No drafts</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Draft tasks will appear here before they're promoted to the main backlog.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div 
                key={draft.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
                onClick={() => onEditTask(draft)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{draft.title}</h3>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">
                        Draft
                      </span>
                      {draft.priority && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(draft.priority)}`}>
                          {draft.priority}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                      <span>{draft.id}</span>
                      <span>Created: {new Date(draft.createdDate).toLocaleDateString()}</span>
                      {draft.updatedDate && (
                        <span>Updated: {new Date(draft.updatedDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {draft.assignee && draft.assignee.length > 0 && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Assigned to:</span>
                        <div className="flex flex-wrap gap-1">
                          {draft.assignee.map((person) => (
                            <span key={person} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-full">
                              {person}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {draft.labels && draft.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {draft.labels.map((label) => (
                          <span key={label} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftsList;