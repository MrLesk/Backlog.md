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
	// Find if there's already an Acceptance Criteria section
	const criteriaRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = content.match(criteriaRegex);

	const newCriteria = criteria.map((criterion) => `- [ ] ${criterion}`).join("\n");
	const newSection = `## Acceptance Criteria\n\n${newCriteria}`;

	if (match) {
		// Replace existing section
		return content.replace(criteriaRegex, newSection);
	}
	// Add new section at the end
	return `${content}\n\n${newSection}`;
}

export function updateTaskImplementationPlan(content: string, plan: string): string {
	// Don't add empty plan
	if (!plan || !plan.trim()) {
		return content;
	}

	// Find if there's already an Implementation Plan section (support both \n and \r\n)
	const planRegex = /## Implementation Plan\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/i;
	const match = content.match(planRegex);

	const newSection = `## Implementation Plan\n\n${plan}`;

	if (match) {
		// Replace existing section, ensuring proper spacing after
		const hasFollowingSection = /\r?\n## /.test(content.slice((match.index || 0) + match[0].length));
		const replacement = hasFollowingSection ? `${newSection}\n` : newSection;
		return content.replace(planRegex, replacement);
	}

	// Find where to insert the new section
	// It should come after Acceptance Criteria if it exists, otherwise after Description
	const acceptanceCriteriaRegex = /## Acceptance Criteria\s*\r?\n[\s\S]*?(?=\r?\n## |$)/i;
	const acceptanceMatch = content.match(acceptanceCriteriaRegex);

	if (acceptanceMatch && acceptanceMatch.index !== undefined) {
		// Insert after Acceptance Criteria
		const insertIndex = acceptanceMatch.index + acceptanceMatch[0].length;
		return `${content.slice(0, insertIndex)}\n\n${newSection}${content.slice(insertIndex)}`;
	}

	// Otherwise insert after Description
	const descriptionRegex = /## Description\s*\r?\n[\s\S]*?(?=\r?\n## |$)/i;
	const descMatch = content.match(descriptionRegex);

	if (descMatch && descMatch.index !== undefined) {
		const insertIndex = descMatch.index + descMatch[0].length;
		return `${content.slice(0, insertIndex)}\n\n${newSection}${content.slice(insertIndex)}`;
	}

	// If no Description section found, add at the end
	return `${content}\n\n${newSection}`;
}

export function updateTaskImplementationNotes(content: string, notes: string): string {
	// Don't add empty notes
	if (!notes || !notes.trim()) {
		return content;
	}

	// Find if there's already an Implementation Notes section (support both \n and \r\n)
	const notesRegex = /## Implementation Notes\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/i;
	const match = content.match(notesRegex);

	if (match) {
		// Overwrite existing Implementation Notes section with the new notes
		const newNotes = notes;
		const hasFollowingSection = /\r?\n## /.test(content.slice((match.index || 0) + match[0].length));
		const replacement = hasFollowingSection
			? `## Implementation Notes\n\n${newNotes}\n`
			: `## Implementation Notes\n\n${newNotes}`;
		return content.replace(notesRegex, replacement);
	}

	// Add new section - Implementation Notes should come after Implementation Plan if it exists
	const newSection = `## Implementation Notes\n\n${notes}`;

	// Find where to insert the new section
	// It should come after Implementation Plan if it exists
	const planRegex = /## Implementation Plan\s*\r?\n[\s\S]*?(?=\r?\n## |$)/i;
	const planMatch = content.match(planRegex);

	if (planMatch && planMatch.index !== undefined) {
		// Insert after Implementation Plan
		const insertIndex = planMatch.index + planMatch[0].length;
		return `${content.slice(0, insertIndex)}\n\n${newSection}${content.slice(insertIndex)}`;
	}

	// Otherwise after Acceptance Criteria
	const acceptanceCriteriaRegex = /## Acceptance Criteria\s*\r?\n[\s\S]*?(?=\r?\n## |$)/i;
	const acceptanceMatch = content.match(acceptanceCriteriaRegex);

	if (acceptanceMatch && acceptanceMatch.index !== undefined) {
		// Insert after Acceptance Criteria
		const insertIndex = acceptanceMatch.index + acceptanceMatch[0].length;
		return `${content.slice(0, insertIndex)}\n\n${newSection}${content.slice(insertIndex)}`;
	}

	// Otherwise after Description
	const descriptionRegex = /## Description\s*\r?\n[\s\S]*?(?=\r?\n## |$)/i;
	const descMatch = content.match(descriptionRegex);

	if (descMatch && descMatch.index !== undefined) {
		const insertIndex = descMatch.index + descMatch[0].length;
		return `${content.slice(0, insertIndex)}\n\n${newSection}${content.slice(insertIndex)}`;
	}

	// If no other sections found, add at the end
	return `${content}\n\n${newSection}`;
}

export function updateTaskDescription(content: string, description: string): string {
	// Find if there's already a Description section
	const descriptionRegex = /## Description\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/i;
	const match = content.match(descriptionRegex);

	const newSection = `## Description\n\n${description}`;

	if (match) {
		// Replace existing section
		return content.replace(descriptionRegex, newSection);
	}

	// If no Description section found, add at the beginning after any frontmatter
	// Look for the end of frontmatter (after ---)
	const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n\n?/;
	const frontmatterMatch = content.match(frontmatterRegex);

	if (frontmatterMatch && frontmatterMatch.index !== undefined) {
		const insertIndex = frontmatterMatch.index + frontmatterMatch[0].length;
		return `${content.slice(0, insertIndex)}${newSection}\n\n${content.slice(insertIndex)}`;
	}

	// If no frontmatter found, add at the beginning
	return `${newSection}\n\n${content}`;
}
