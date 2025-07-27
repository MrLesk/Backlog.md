import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/api";
import type { Sequence, Task } from "../../types";

export default function SequencesPage() {
        const [sequences, setSequences] = useState<Sequence[]>([]);
        const [error, setError] = useState<string | null>(null);
        const [draggedTask, setDraggedTask] = useState<{task: Task; from: number} | null>(null);

        useEffect(() => {
                loadSequences();
        }, []);

        async function loadSequences() {
                try {
                        const data = await apiClient.fetchSequences();
                        setSequences(data);
                        setError(null);
                } catch (err) {
                        setError((err as Error).message);
                }
        }

        async function moveTask(task: Task, targetSequence: number) {
                try {
                        await apiClient.moveTaskToSequence(task.id, targetSequence);
                        await loadSequences();
                } catch (err) {
                        alert((err as Error).message);
                }
        }

        const handleDragStart = (task: Task, seqNum: number) => {
                setDraggedTask({ task, from: seqNum });
        };

        const handleDrop = (seqNum: number) => {
                if (draggedTask) {
                        moveTask(draggedTask.task, seqNum);
                        setDraggedTask(null);
                }
        };

        return (
                <div className="p-6 space-y-8">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planning</h1>
                        {error && <div className="text-red-500">{error}</div>}
                        {sequences.map((sequence) => (
                                <div
                                        key={sequence.number}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => handleDrop(sequence.number)}
                                        className="border border-gray-300 dark:border-gray-700 rounded-md p-4"
                                >
                                        <h2 className="font-semibold mb-2">Sequence {sequence.number}</h2>
                                        {sequence.tasks.length === 0 ? (
                                                <div className="text-gray-500">No tasks</div>
                                        ) : (
                                                <ul className="space-y-2">
                                                        {sequence.tasks.map((task) => (
                                                                <li
                                                                        key={task.id}
                                                                        draggable
                                                                        onDragStart={() => handleDragStart(task, sequence.number)}
                                                                        className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md cursor-move"
                                                                >
                                                                        {task.id} - {task.title}
                                                                </li>
                                                        ))}
                                                </ul>
                                        )}
                                </div>
                        ))}
                </div>
        );
}
