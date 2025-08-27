import React, { useEffect, useState, useRef } from "react";
import { type Task, type Sequence } from "../../types";
import TaskCard from "./TaskCard";
import { apiClient } from "../lib/api";
import { SuccessToast } from "./SuccessToast";

interface SequencesData {
        unsequenced: Task[];
        sequences: Sequence[];
}

interface SequencesPageProps {
        onEditTask: (task: Task) => void;
        api?: {
                fetchSequences: () => Promise<SequencesData>;
                moveTaskInSequence: (
                        taskId: string,
                        opts: { targetSequenceIndex?: number; unsequenced?: boolean }
                ) => Promise<SequencesData>;
        };
}

export default function SequencesPage({ onEditTask, api = apiClient }: SequencesPageProps) {
        const [data, setData] = useState<SequencesData | null>(null);
        const [error, setError] = useState<string | null>(null);
        const [showSuccess, setShowSuccess] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);

        const load = async () => {
                try {
                        const res = await api.fetchSequences();
                        setData(res);
                } catch {
                        setError("Failed to load sequences");
                }
        };

        useEffect(() => {
                load();
        }, []);

        const handleDrop = async (
                e: React.DragEvent<HTMLDivElement>,
                target: number | "unsequenced"
        ) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                if (!taskId) return;
                const scroll = containerRef.current?.scrollTop ?? 0;
                try {
                        const res =
                                target === "unsequenced"
                                        ? await api.moveTaskInSequence(taskId, { unsequenced: true })
                                        : await api.moveTaskInSequence(taskId, { targetSequenceIndex: target });
                        setData(res);
                        setShowSuccess(true);
                        setTimeout(() => setShowSuccess(false), 2000);
                } catch (err) {
                        setError((err as Error).message);
                        setTimeout(() => setError(null), 3000);
                }
                if (containerRef.current) containerRef.current.scrollTop = scroll;
        };

        if (!data) {
                return <div className="p-6 text-gray-600 dark:text-gray-300">Loading...</div>;
        }

        const columns: Array<{ key: string; title: string; tasks: Task[] }> = [];
        if (data.unsequenced.length > 0) {
                columns.push({ key: "unsequenced", title: "Unsequenced", tasks: data.unsequenced });
        }
        for (const seq of data.sequences) {
                columns.push({ key: String(seq.index), title: `Sequence ${seq.index}`, tasks: seq.tasks });
        }

        if (columns.length === 0) {
                return (
                        <div className="p-6 text-gray-600 dark:text-gray-300">No active tasks</div>
                );
        }

        return (
                <div ref={containerRef} className="p-6 flex gap-4 overflow-x-auto">
                        {columns.map((col) => (
                                <div
                                        key={col.key}
                                        className="w-64 flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-md p-4"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) =>
                                                handleDrop(
                                                        e,
                                                        col.key === "unsequenced"
                                                                ? "unsequenced"
                                                                : Number(col.key)
                                                )
                                        }
                                        data-sequence-index={col.key}
                                >
                                        <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-100">
                                                {col.title}
                                        </h2>
                                        <div className="space-y-3">
                                                {col.tasks.map((task) => (
                                                        <div key={task.id} data-task-id={task.id}>
                                                                <TaskCard task={task} onUpdate={() => {}} onEdit={onEditTask} />
                                                        </div>
                                                ))}
                                                {col.tasks.length === 0 && (
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                No tasks
                                                        </div>
                                                )}
                                        </div>
                                </div>
                        ))}
                        {showSuccess && (
                                <SuccessToast
                                        message="Task moved"
                                        onDismiss={() => setShowSuccess(false)}
                                />
                        )}
                        {error && (
                                <div className="text-red-600 dark:text-red-400 fixed bottom-4 right-4">
                                        {error}
                                </div>
                        )}
                </div>
        );
}
