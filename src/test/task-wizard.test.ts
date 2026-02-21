import { describe, expect, it } from "bun:test";
import {
	pickTaskForEditWizard,
	runTaskCreateWizard,
	runTaskEditWizard,
	TaskWizardCancelledError,
	type TaskWizardPromptRunner,
} from "../commands/task-wizard.ts";
import type { Task } from "../types/index.ts";

type PromptResponses = Record<string, string | string[]>;

function createPromptRunner(responses: PromptResponses): TaskWizardPromptRunner {
	const state = new Map<string, string[]>();
	for (const [key, value] of Object.entries(responses)) {
		state.set(key, Array.isArray(value) ? [...value] : [value]);
	}

	return async (question) => {
		const queue = state.get(question.name) ?? [];
		if (queue.length === 0) {
			return { [question.name]: question.initial ?? "" };
		}
		while (queue.length > 0) {
			const candidate = queue.shift() ?? "";
			const validationResult = question.validate?.(candidate);
			if (!validationResult) {
				state.set(question.name, queue);
				return { [question.name]: candidate };
			}
		}
		throw new Error(`No valid prompt value remaining for '${question.name}'.`);
	};
}

describe("task wizard", () => {
	it("builds create input from shared wizard fields", async () => {
		const prompt = createPromptRunner({
			title: "Create from wizard",
			description: "Wizard description",
			status: "inprogress",
			priority: "MEDIUM",
			assignee: "alice, @bob",
			labels: "cli, wizard",
			acceptanceCriteria: "[x] First criterion, Second criterion",
			definitionOfDone: "Run tests, [x] Update docs",
			implementationPlan: "Step 1\nStep 2",
			implementationNotes: "Decision notes",
			references: "src/cli.ts, docs/plan.md",
			documentation: "docs/spec.md",
			dependencies: "task-1,2",
		});

		const input = await runTaskCreateWizard({
			statuses: ["To Do", "In Progress", "Done"],
			promptImpl: prompt,
		});

		expect(input).not.toBeNull();
		expect(input?.title).toBe("Create from wizard");
		expect(input?.description).toBe("Wizard description");
		expect(input?.status).toBe("In Progress");
		expect(input?.priority).toBe("medium");
		expect(input?.assignee).toEqual(["alice", "@bob"]);
		expect(input?.labels).toEqual(["cli", "wizard"]);
		expect(input?.acceptanceCriteria).toEqual([
			{ text: "First criterion", checked: false },
			{ text: "Second criterion", checked: false },
		]);
		expect(input?.definitionOfDoneAdd).toEqual(["Run tests", "Update docs"]);
		expect(input?.implementationPlan).toBe("Step 1\nStep 2");
		expect(input?.implementationNotes).toBe("Decision notes");
		expect(input?.references).toEqual(["src/cli.ts", "docs/plan.md"]);
		expect(input?.documentation).toEqual(["docs/spec.md"]);
		expect(input?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	it("builds prefilled edit update input", async () => {
		const existingTask: Task = {
			id: "task-9",
			title: "Old title",
			status: "To Do",
			priority: "low",
			assignee: ["alice"],
			createdDate: "2026-02-20 12:00",
			labels: ["existing"],
			dependencies: ["task-1"],
			references: ["docs/old.md"],
			documentation: ["docs/current.md"],
			description: "Old description",
			implementationPlan: "Old plan",
			implementationNotes: "Old notes",
			acceptanceCriteriaItems: [
				{ index: 1, text: "Old AC 1", checked: false },
				{ index: 2, text: "Old AC 2", checked: true },
			],
			definitionOfDoneItems: [
				{ index: 1, text: "Old DoD 1", checked: false },
				{ index: 2, text: "Old DoD 2", checked: true },
			],
			rawContent: "",
		};
		const prompt = createPromptRunner({
			title: "New title",
			description: "New description",
			status: "In Progress",
			priority: "high",
			assignee: "alice, bob",
			labels: "existing, cli",
			acceptanceCriteria: "[x] New AC 1, [ ] New AC 2",
			definitionOfDone: "[x] New DoD 1, [ ] New DoD 2",
			implementationPlan: "New plan",
			implementationNotes: "New notes",
			references: "docs/new.md,src/cli.ts",
			documentation: "docs/spec.md",
			dependencies: "task-2,3",
		});

		const updateInput = await runTaskEditWizard({
			task: existingTask,
			statuses: ["To Do", "In Progress", "Done"],
			promptImpl: prompt,
		});

		expect(updateInput).not.toBeNull();
		expect(updateInput?.title).toBe("New title");
		expect(updateInput?.description).toBe("New description");
		expect(updateInput?.status).toBe("In Progress");
		expect(updateInput?.priority).toBe("high");
		expect(updateInput?.assignee).toEqual(["alice", "bob"]);
		expect(updateInput?.labels).toEqual(["existing", "cli"]);
		expect(updateInput?.dependencies).toEqual(["TASK-2", "TASK-3"]);
		expect(updateInput?.references).toEqual(["docs/new.md", "src/cli.ts"]);
		expect(updateInput?.documentation).toEqual(["docs/spec.md"]);
		expect(updateInput?.implementationPlan).toBe("New plan");
		expect(updateInput?.implementationNotes).toBe("New notes");
		expect(updateInput?.acceptanceCriteria).toEqual([
			{ text: "New AC 1", checked: true },
			{ text: "New AC 2", checked: false },
		]);
		expect(updateInput?.removeDefinitionOfDone).toEqual([1, 2]);
		expect(updateInput?.addDefinitionOfDone).toEqual(["New DoD 1", "New DoD 2"]);
		expect(updateInput?.checkDefinitionOfDone).toEqual([3]);
	});

	it("supports edit picker flow", async () => {
		const prompt = createPromptRunner({
			taskId: "task-2",
		});
		const selected = await pickTaskForEditWizard({
			tasks: [
				{ id: "task-3", title: "Third" },
				{ id: "task-2", title: "Second" },
				{ id: "task-1", title: "First" },
			],
			promptImpl: prompt,
		});

		expect(selected).toBe("task-2");
	});

	it("returns null when wizard is cancelled", async () => {
		const cancelledPrompt: TaskWizardPromptRunner = async () => {
			throw new TaskWizardCancelledError();
		};

		const createInput = await runTaskCreateWizard({
			statuses: ["To Do", "Done"],
			promptImpl: cancelledPrompt,
		});
		expect(createInput).toBeNull();
	});

	it("uses prompt-level validation for required and status fields", async () => {
		const prompt = createPromptRunner({
			title: ["   ", "Validated title"],
			description: "",
			status: ["not-a-real-status", "To Do"],
			priority: "",
			assignee: "",
			labels: "",
			acceptanceCriteria: "",
			definitionOfDone: "",
			implementationPlan: "",
			implementationNotes: "",
			references: "",
			documentation: "",
			dependencies: "",
		});

		const input = await runTaskCreateWizard({
			statuses: ["To Do", "In Progress", "Done"],
			promptImpl: prompt,
		});

		expect(input).not.toBeNull();
		expect(input?.title).toBe("Validated title");
		expect(input?.status).toBe("To Do");
	});
});
