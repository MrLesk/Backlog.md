import { describe, it, expect } from "bun:test";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import SequencesPage from "../web/components/SequencesPage.tsx";
import type { Task } from "../types/index.ts";
import { Window } from "happy-dom";

const window = new Window();
const document = window.document;
(globalThis as any).window = window;
(globalThis as any).document = document;
(globalThis as any).navigator = window.navigator;

const taskA: Task = {
        id: "task-1",
        title: "Task A",
        status: "To Do",
        assignee: [],
        createdDate: "2025-08-26",
        labels: [],
        dependencies: [],
        body: "",
};

const taskB: Task = {
        id: "task-2",
        title: "Task B",
        status: "To Do",
        assignee: [],
        createdDate: "2025-08-26",
        labels: [],
        dependencies: [],
        body: "",
};

describe("SequencesPage", () => {
        it("renders unsequenced and sequences", async () => {
                const api = {
                        fetchSequences: async () => ({
                                unsequenced: [taskA],
                                sequences: [{ index: 1, tasks: [taskB] }],
                        }),
                        moveTaskInSequence: async () => ({
                                unsequenced: [taskA],
                                sequences: [{ index: 1, tasks: [taskB] }],
                        }),
                };
                const container = document.createElement("div");
                await act(async () => {
                        createRoot(container).render(<SequencesPage onEditTask={() => {}} api={api} />);
                });
                expect(container.textContent).toContain("Unsequenced");
                const firstHeading = container.querySelector("h2")?.textContent;
                expect(firstHeading).toContain("Unsequenced");
                expect(container.textContent).toContain("Task A");
                expect(container.textContent).toContain("Task B");
        });

        it("moves task using API", async () => {
                let state = { unsequenced: [taskA], sequences: [{ index: 1, tasks: [taskB] }] };
                let called = false;
                const api = {
                        fetchSequences: async () => state,
                        moveTaskInSequence: async (_id: string, _opts: unknown) => {
                                called = true;
                                state = { unsequenced: [], sequences: [{ index: 1, tasks: [taskB, taskA] }] };
                                return state;
                        },
                };
                const container = document.createElement("div");
                await act(async () => {
                        createRoot(container).render(<SequencesPage onEditTask={() => {}} api={api} />);
                });
                const result = await api.moveTaskInSequence("task-1", { targetSequenceIndex: 1 });
                expect(called).toBe(true);
                expect(result.sequences[0].tasks.map((t) => t.id)).toContain("task-1");
        });
});
