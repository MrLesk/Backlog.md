import matter from "gray-matter";
import type { DecisionLog, Document, ParsedMarkdown, Task } from "../types/index.ts";

function normalizeDate(value: unknown): string {
	if (!value) return "";
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	const str = String(value)
		.trim()
		.replace(/^['"]|['"]$/g, "");
	if (!str) return "";
	let match: RegExpMatchArray | null = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) {
		return `${match[1]}-${match[2]}-${match[3]}`;
	}
	match = str.match(/^(\d{2})-(\d{2})-(\d{2})$/);
	if (match) {
		const [day, month, year] = match.slice(1);
		return `20${year}-${month}-${day}`;
	}
	match = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
	if (match) {
		const [day, month, year] = match.slice(1);
		return `20${year}-${month}-${day}`;
	}
	match = str.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
	if (match) {
		const [day, month, year] = match.slice(1);
		return `20${year}-${month}-${day}`;
	}
	return str;
}

export function parseMarkdown(content: string): ParsedMarkdown {
	const parsed = matter(content);
	return {
		frontmatter: parsed.data,
		content: parsed.content.trim(),
	};
}

export function parseTask(content: string): Task {
	const { frontmatter, content: description } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		title: String(frontmatter.title || ""),
		status: String(frontmatter.status || ""),
		assignee: Array.isArray(frontmatter.assignee)
			? frontmatter.assignee.map(String)
			: frontmatter.assignee
				? [String(frontmatter.assignee)]
				: [],
		reporter: frontmatter.reporter ? String(frontmatter.reporter) : undefined,
		createdDate: normalizeDate(frontmatter.created_date),
		updatedDate: frontmatter.updated_date ? String(frontmatter.updated_date) : undefined,
		labels: Array.isArray(frontmatter.labels) ? frontmatter.labels.map(String) : [],
		milestone: frontmatter.milestone ? String(frontmatter.milestone) : undefined,
		dependencies: Array.isArray(frontmatter.dependencies) ? frontmatter.dependencies.map(String) : [],
		description: description,
		acceptanceCriteria: extractAcceptanceCriteria(description),
		parentTaskId: frontmatter.parent_task_id ? String(frontmatter.parent_task_id) : undefined,
		subtasks: Array.isArray(frontmatter.subtasks) ? frontmatter.subtasks.map(String) : undefined,
	};
}

export function parseDecisionLog(content: string): DecisionLog {
	const { frontmatter, content: body } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		title: String(frontmatter.title || ""),
		date: normalizeDate(frontmatter.date),
		status: String(frontmatter.status || "proposed") as DecisionLog["status"],
		context: extractSection(body, "Context") || "",
		decision: extractSection(body, "Decision") || "",
		consequences: extractSection(body, "Consequences") || "",
		alternatives: extractSection(body, "Alternatives"),
	};
}

function extractAcceptanceCriteria(content: string): string[] {
	const criteriaSection = extractSection(content, "Acceptance Criteria");
	if (!criteriaSection) return [];

	return criteriaSection
		.split("\n")
		.filter((line) => line.trim().startsWith("- [ ]") || line.trim().startsWith("- [x]"))
		.map((line) => line.trim().replace(/^- \[[ x]\] /, ""));
}

function extractSection(content: string, sectionTitle: string): string | undefined {
	const regex = new RegExp(`## ${sectionTitle}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
	const match = content.match(regex);
	return match?.[1]?.trim();
}
