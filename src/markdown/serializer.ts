import matter from "gray-matter";
import { AcceptanceCriteriaManager } from "../core/acceptance-criteria.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { normalizeAssignee } from "../utils/assignee.ts";

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
	if (typeof task.description === "string") {
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

	let out: string;
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
	// Don't add empty plan
	if (!plan || !plan.trim()) {
		return content;
	}

	// Normalize to LF while computing, preserve original EOL at return
	const useCRLF = /\r\n/.test(content);
	const src = content.replace(/\r\n/g, "\n");

	// Find if there's already an Implementation Plan section
	const planRegex = /## Implementation Plan\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = src.match(planRegex);

	const newSection = `## Implementation Plan\n\n${plan}`;

	let out: string;
	if (match) {
		// Replace existing section, ensuring exactly one blank line after when followed by other content
		const afterIdx = (match.index || 0) + match[0].length;
		const hasFollowingSection = /\n## /.test(src.slice(afterIdx));
		const replacement = hasFollowingSection ? `${newSection}\n\n` : newSection;
		out = src.replace(planRegex, replacement);
	}
	// Find where to insert the new section
	// It should come after Acceptance Criteria if it exists, otherwise after Description
	const acceptanceCriteriaRegex = /## Acceptance Criteria\s*\n[\s\S]*?(?=\n## |$)/i;
	const acceptanceMatch = src.match(acceptanceCriteriaRegex);

	if (!out && acceptanceMatch && acceptanceMatch.index !== undefined) {
		// Insert after Acceptance Criteria, normalizing surrounding blank lines
		const insertIndex = acceptanceMatch.index + acceptanceMatch[0].length;
		const before = src.slice(0, insertIndex).replace(/\n+$/, "");
		const after = src.slice(insertIndex).replace(/^\n+/, "");
		out = `${before}\n\n${newSection}${after ? "\n\n" : ""}${after}`;
	}

	// Otherwise insert after Description
	const descriptionRegex = /## Description\s*\n[\s\S]*?(?=\n## |$)/i;
	const descMatch = src.match(descriptionRegex);

	if (!out && descMatch && descMatch.index !== undefined) {
		const insertIndex = descMatch.index + descMatch[0].length;
		const before = src.slice(0, insertIndex).replace(/\n+$/, "");
		const after = src.slice(insertIndex).replace(/^\n+/, "");
		out = `${before}\n\n${newSection}${after ? "\n\n" : ""}${after}`;
	}

	// If still not inserted, add at the end
	if (!out) out = `${src.replace(/\n+$/, "")}\n\n${newSection}`;
	return useCRLF ? out.replace(/\n/g, "\r\n") : out;
}

export function updateTaskImplementationNotes(content: string, notes: string): string {
	// Don't add empty notes
	if (!notes || !notes.trim()) {
		return content;
	}

	// Normalize to LF while computing, preserve original EOL at return
	const useCRLF = /\r\n/.test(content);
	const src = content.replace(/\r\n/g, "\n");

	// Find if there's already an Implementation Notes section
	const notesRegex = /## Implementation Notes\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = src.match(notesRegex);

	let out: string;
	if (match) {
		// Overwrite existing Implementation Notes section with the new notes and normalize spacing
		const newNotes = notes;
		const afterIdx = (match.index || 0) + match[0].length;
		const hasFollowingSection = /\n## /.test(src.slice(afterIdx));
		const replacement = hasFollowingSection
			? `## Implementation Notes\n\n${newNotes}\n\n`
			: `## Implementation Notes\n\n${newNotes}`;
		out = src.replace(notesRegex, replacement);
	}

	// Add new section - Implementation Notes should come after Implementation Plan if it exists
	const newSection = `## Implementation Notes\n\n${notes}`;

	// Find where to insert the new section
	// It should come after Implementation Plan if it exists
	const planRegex = /## Implementation Plan\s*\n[\s\S]*?(?=\n## |$)/i;
	const planMatch = src.match(planRegex);

	if (!out && planMatch && planMatch.index !== undefined) {
		// Insert after Implementation Plan, normalizing surrounding blank lines
		const insertIndex = planMatch.index + planMatch[0].length;
		const before = src.slice(0, insertIndex).replace(/\n+$/, "");
		const after = src.slice(insertIndex).replace(/^\n+/, "");
		out = `${before}\n\n${newSection}${after ? "\n\n" : ""}${after}`;
	}

	// Otherwise after Acceptance Criteria
	const acceptanceCriteriaRegex = /## Acceptance Criteria\s*\n[\s\S]*?(?=\n## |$)/i;
	const acceptanceMatch = src.match(acceptanceCriteriaRegex);

	if (!out && acceptanceMatch && acceptanceMatch.index !== undefined) {
		// Insert after Acceptance Criteria, normalizing surrounding blank lines
		const insertIndex = acceptanceMatch.index + acceptanceMatch[0].length;
		const before = src.slice(0, insertIndex).replace(/\n+$/, "");
		const after = src.slice(insertIndex).replace(/^\n+/, "");
		out = `${before}\n\n${newSection}${after ? "\n\n" : ""}${after}`;
	}

	// Otherwise after Description
	const descriptionRegex = /## Description\s*\n[\s\S]*?(?=\n## |$)/i;
	const descMatch = src.match(descriptionRegex);

	if (!out && descMatch && descMatch.index !== undefined) {
		const insertIndex = descMatch.index + descMatch[0].length;
		const before = src.slice(0, insertIndex).replace(/\n+$/, "");
		const after = src.slice(insertIndex).replace(/^\n+/, "");
		out = `${before}\n\n${newSection}${after ? "\n\n" : ""}${after}`;
	}

	// If no other sections found, add at the end
	if (!out) out = `${src.replace(/\n+$/, "")}\n\n${newSection}`;
	return useCRLF ? out.replace(/\n/g, "\r\n") : out;
}

export function updateTaskDescription(content: string, description: string): string {
	// Normalize to LF while computing, preserve original EOL at return
	const useCRLF = /\r\n/.test(content);
	const src = content.replace(/\r\n/g, "\n");
	// Find if there's already a Description section
	const descriptionRegex = /## Description\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = src.match(descriptionRegex);

	const newSection = `## Description\n\n${description}`;

	let out: string | null = null;
	if (match) {
		// Replace existing section
		out = src.replace(descriptionRegex, newSection);
	}

	// If no Description section found, add at the beginning after any frontmatter
	// Look for the end of frontmatter (after ---)
	const frontmatterRegex = /^---\n[\s\S]*?\n---\n\n?/;
	const frontmatterMatch = src.match(frontmatterRegex);

	if (!out && frontmatterMatch && frontmatterMatch.index !== undefined) {
		const insertIndex = frontmatterMatch.index + frontmatterMatch[0].length;
		out = `${src.slice(0, insertIndex)}${newSection}\n\n${src.slice(insertIndex)}`;
	}

	// If no frontmatter found, add at the beginning
	if (!out) out = `${newSection}\n\n${src}`;
	return useCRLF ? out.replace(/\n/g, "\r\n") : out;
}
