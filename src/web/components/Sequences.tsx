import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/api";
import type { Sequence, Task } from "../../types";

export default function Sequences() {
  const [data, setData] = useState<{ unsequenced: Task[]; sequences: Sequence[] }>({
    unsequenced: [],
    sequences: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const next = await apiClient.fetchSequences();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sequences");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading sequences...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
        <button
          onClick={load}
          className="ml-4 inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalCount =
    data.unsequenced.length + data.sequences.reduce((sum, s) => sum + s.tasks.length, 0);

  if (totalCount === 0) {
    return (
      <div className="flex-1 bg-white dark:bg-gray-900 transition-colors duration-200">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Sequences</h1>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No active sequences
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tasks will appear here once they are sequenced.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 transition-colors duration-200">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sequences</h1>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {totalCount} task{totalCount !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="space-y-8">
          {data.unsequenced.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Unsequenced</h2>
              <ul className="space-y-2">
                {data.unsequenced.map((task) => (
                  <li
                    key={task.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900 dark:text-gray-100">{task.title}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{task.id}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.sequences.map((seq) => (
            <div
              key={seq.index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Sequence {seq.index}
              </h2>
              <ul className="space-y-2">
                {seq.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900 dark:text-gray-100">{task.title}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{task.id}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

