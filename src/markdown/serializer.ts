import matter from "gray-matter";
import type { Decision, Document, Task } from "../types/index.ts";
import { normalizeAssignee } from "../utils/assignee.ts";
import { AcceptanceCriteriaManager, getStructuredSections, updateStructuredSections } from "./structured-sections.ts";

export function serializeTask(task: Task): string {
	normalizeAssignee(task);
	const frontmatter = {
		id: task.id,
		title: task.title,
		status: task.status,
		assignee: task.assignee,
		...(task.reporter && { reporter: task.reporter }),
		created_date: task.createdDate,
		...(task.updatedDate && { updated_date: task.updatedDate }),
		labels: task.labels,
		...(task.milestone && { milestone: task.milestone }),
		dependencies: task.dependencies,
		...(task.parentTaskId && { parent_task_id: task.parentTaskId }),
		...(task.subtasks && task.subtasks.length > 0 && { subtasks: task.subtasks }),
		...(task.priority && { priority: task.priority }),
		...(task.ordinal !== undefined && { ordinal: task.ordinal }),
	};

	// Compose from first-party fields when present, preserving other content
	let contentBody = task.body;
	if (typeof task.description === "string" && task.description.trim() !== "") {
		contentBody = updateTaskDescription(contentBody, task.description);
	}
	if (Array.isArray(task.acceptanceCriteriaItems) && task.acceptanceCriteriaItems.length > 0) {
		contentBody = AcceptanceCriteriaManager.updateContent(contentBody, task.acceptanceCriteriaItems);
	}
	if (typeof task.implementationPlan === "string") {
		contentBody = updateTaskImplementationPlan(contentBody, task.implementationPlan);
	}
	if (typeof task.implementationNotes === "string") {
		contentBody = updateTaskImplementationNotes(contentBody, task.implementationNotes);
	}

	const serialized = matter.stringify(contentBody, frontmatter);
	// Ensure there's a blank line between frontmatter and content
	return serialized.replace(/^(---\n(?:.*\n)*?---)\n(?!$)/, "$1\n\n");
}

export function serializeDecision(decision: Decision): string {
	const frontmatter = {
		id: decision.id,
		title: decision.title,
		date: decision.date,
		status: decision.status,
	};

	let content = `## Context\n\n${decision.context}\n\n`;
	content += `## Decision\n\n${decision.decision}\n\n`;
	content += `## Consequences\n\n${decision.consequences}`;

	if (decision.alternatives) {
		content += `\n\n## Alternatives\n\n${decision.alternatives}`;
	}

	return matter.stringify(content, frontmatter);
}

export function serializeDocument(document: Document): string {
	const frontmatter = {
		id: document.id,
		title: document.title,
		type: document.type,
		created_date: document.createdDate,
		...(document.updatedDate && { updated_date: document.updatedDate }),
		...(document.tags && document.tags.length > 0 && { tags: document.tags }),
	};

	return matter.stringify(document.body, frontmatter);
}

export function updateTaskAcceptanceCriteria(content: string, criteria: string[]): string {
	// Normalize to LF while computing, preserve original EOL at return
	const useCRLF = /\r\n/.test(content);
	const src = content.replace(/\r\n/g, "\n");
	// Find if there's already an Acceptance Criteria section
	const criteriaRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = src.match(criteriaRegex);

	const newCriteria = criteria.map((criterion) => `- [ ] ${criterion}`).join("\n");
	const newSection = `## Acceptance Criteria\n\n${newCriteria}`;

	let out: string | undefined;
	if (match) {
		// Replace existing section
		out = src.replace(criteriaRegex, newSection);
	} else {
		// Add new section at the end
		out = `${src}\n\n${newSection}`;
	}
	return useCRLF ? out.replace(/\n/g, "\r\n") : out;
}

export function updateTaskImplementationPlan(content: string, plan: string): string {
	const sections = getStructuredSections(content);
	return updateStructuredSections(content, {
		description: sections.description ?? "",
		implementationPlan: plan,
		implementationNotes: sections.implementationNotes ?? "",
	});
}

export function updateTaskImplementationNotes(content: string, notes: string): string {
	const sections = getStructuredSections(content);
	return updateStructuredSections(content, {
		description: sections.description ?? "",
		implementationPlan: sections.implementationPlan ?? "",
		implementationNotes: notes,
	});
}

export function appendTaskImplementationNotes(content: string, notesChunks: string | string[]): string {
	const chunks = (Array.isArray(notesChunks) ? notesChunks : [notesChunks])
		.map((c) => String(c))
		.map((c) => c.replace(/\r\n/g, "\n"))
		.map((c) => c.trim())
		.filter(Boolean);

	const sections = getStructuredSections(content);
	const appendedBlock = chunks.join("\n\n");
	const existingNotes = sections.implementationNotes?.trim();
	const combined = existingNotes ? `${existingNotes}\n\n${appendedBlock}` : appendedBlock;
	return updateStructuredSections(content, {
		description: sections.description ?? "",
		implementationPlan: sections.implementationPlan ?? "",
		implementationNotes: combined,
	});
}

export function updateTaskDescription(content: string, description: string): string {
	const sections = getStructuredSections(content);
	return updateStructuredSections(content, {
		description,
		implementationPlan: sections.implementationPlan ?? "",
		implementationNotes: sections.implementationNotes ?? "",
	});
}
