import matter from "gray-matter";
import type { DecisionLog, Document, Task } from "../types/index.ts";

export function serializeTask(task: Task): string {
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
	};

	const serialized = matter.stringify(task.description, frontmatter);
	// Ensure there's a blank line between frontmatter and content
	return serialized.replace(/^(---\n(?:.*\n)*?---)\n(?!$)/, "$1\n\n");
}

export function serializeDecisionLog(decision: DecisionLog): string {
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

	return matter.stringify(document.content, frontmatter);
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

	// Find if there's already an Implementation Plan section
	const planRegex = /## Implementation Plan\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = content.match(planRegex);

	const newSection = `## Implementation Plan\n\n${plan}`;

	if (match) {
		// Replace existing section
		return content.replace(planRegex, newSection);
	}

	// Find where to insert the new section
	// It should come after Acceptance Criteria if it exists, otherwise after Description
	const acceptanceCriteriaRegex = /## Acceptance Criteria\s*\n[\s\S]*?(?=\n## |$)/i;
	const acceptanceMatch = content.match(acceptanceCriteriaRegex);

	if (acceptanceMatch && acceptanceMatch.index !== undefined) {
		// Insert after Acceptance Criteria
		const insertIndex = acceptanceMatch.index + acceptanceMatch[0].length;
		return `${content.slice(0, insertIndex)}\n\n${newSection}${content.slice(insertIndex)}`;
	}

	// Otherwise insert after Description
	const descriptionRegex = /## Description\s*\n[\s\S]*?(?=\n## |$)/i;
	const descMatch = content.match(descriptionRegex);

	if (descMatch && descMatch.index !== undefined) {
		const insertIndex = descMatch.index + descMatch[0].length;
		return `${content.slice(0, insertIndex)}\n\n${newSection}${content.slice(insertIndex)}`;
	}

	// If no Description section found, add at the end
	return `${content}\n\n${newSection}`;
}
