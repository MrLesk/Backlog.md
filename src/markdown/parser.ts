import matter from "gray-matter";
import type { AcceptanceCriterion, Decision, Document, ParsedMarkdown, Task } from "../types/index.ts";
import { AcceptanceCriteriaManager, extractStructuredSection, STRUCTURED_SECTION_KEYS } from "./structured-sections.ts";

function preprocessFrontmatter(frontmatter: string): string {
	return frontmatter
		.split(/\r?\n/) // Handle both Windows (\r\n) and Unix (\n) line endings
		.map((line) => {
			// Handle both assignee and reporter fields that start with @
			const match = line.match(/^(\s*(?:assignee|reporter):\s*)(.*)$/);
			if (!match) return line;

			const [, prefix, raw] = match;
			const value = raw?.trim() || "";

			if (
				value &&
				!value.startsWith("[") &&
				!value.startsWith("'") &&
				!value.startsWith('"') &&
				!value.startsWith("-")
			) {
				return `${prefix}"${value.replace(/"/g, '\\"')}"`;
			}
			return line;
		})
		.join("\n"); // Always join with \n for consistent YAML parsing
}

function normalizeDate(value: unknown): string {
	if (!value) return "";
	if (value instanceof Date) {
		// Check if this Date object came from a date-only string (time is midnight UTC)
		const hours = value.getUTCHours();
		const minutes = value.getUTCMinutes();
		const seconds = value.getUTCSeconds();

		if (hours === 0 && minutes === 0 && seconds === 0) {
			// This was likely a date-only value, preserve it as date-only
			return value.toISOString().slice(0, 10);
		}
		// This has actual time information, preserve it
		return value.toISOString().slice(0, 16).replace("T", " ");
	}
	const str = String(value)
		.trim()
		.replace(/^['"]|['"]$/g, "");
	if (!str) return "";

	// Check for datetime format first (YYYY-MM-DD HH:mm)
	let match: RegExpMatchArray | null = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
	if (match) {
		// Already in correct format, return as-is
		return str;
	}

	// Check for ISO datetime format (YYYY-MM-DDTHH:mm)
	match = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
	if (match) {
		// Convert T separator to space
		return str.replace("T", " ");
	}

	// Check for date-only format (YYYY-MM-DD) - backward compatibility
	match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) {
		return `${match[1]}-${match[2]}-${match[3]}`;
	}

	// Legacy date formats (date-only for backward compatibility)
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
	// Updated regex to handle both Windows (\r\n) and Unix (\n) line endings
	const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
	const match = content.match(fmRegex);
	let toParse = content;

	if (match) {
		const processed = preprocessFrontmatter(match[1] || "");
		// Replace with consistent line endings
		toParse = content.replace(fmRegex, `---\n${processed}\n---`);
	}

	const parsed = matter(toParse);
	return {
		frontmatter: parsed.data,
		content: parsed.content.trim(),
	};
}

export function parseTask(content: string): Task {
	const { frontmatter, content: body } = parseMarkdown(content);

	// Validate priority field
	const priority = frontmatter.priority ? String(frontmatter.priority).toLowerCase() : undefined;
	const validPriorities = ["high", "medium", "low"];
	const validatedPriority =
		priority && validPriorities.includes(priority) ? (priority as "high" | "medium" | "low") : undefined;

	// Parse structured acceptance criteria (checked/text/index) from all sections
	const structuredCriteria: AcceptanceCriterion[] = AcceptanceCriteriaManager.parseAllCriteria(body);

	// Parse other sections
	const descriptionSection = extractStructuredSection(body, STRUCTURED_SECTION_KEYS.description) || "";
	const planSection = extractStructuredSection(body, STRUCTURED_SECTION_KEYS.implementationPlan) || undefined;
	const notesSection = extractStructuredSection(body, STRUCTURED_SECTION_KEYS.implementationNotes) || undefined;

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
		updatedDate: frontmatter.updated_date ? normalizeDate(frontmatter.updated_date) : undefined,
		labels: Array.isArray(frontmatter.labels) ? frontmatter.labels.map(String) : [],
		milestone: frontmatter.milestone ? String(frontmatter.milestone) : undefined,
		dependencies: Array.isArray(frontmatter.dependencies) ? frontmatter.dependencies.map(String) : [],
		body: body,
		acceptanceCriteria: extractAcceptanceCriteria(body),
		acceptanceCriteriaItems: structuredCriteria,
		description: descriptionSection,
		implementationPlan: planSection,
		implementationNotes: notesSection,
		parentTaskId: frontmatter.parent_task_id ? String(frontmatter.parent_task_id) : undefined,
		subtasks: Array.isArray(frontmatter.subtasks) ? frontmatter.subtasks.map(String) : undefined,
		priority: validatedPriority,
		ordinal: frontmatter.ordinal !== undefined ? Number(frontmatter.ordinal) : undefined,
	};
}

export function parseDecision(content: string): Decision {
	const { frontmatter, content: body } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		title: String(frontmatter.title || ""),
		date: normalizeDate(frontmatter.date),
		status: String(frontmatter.status || "proposed") as Decision["status"],
		context: extractSection(body, "Context") || "",
		decision: extractSection(body, "Decision") || "",
		consequences: extractSection(body, "Consequences") || "",
		alternatives: extractSection(body, "Alternatives"),
		body: body, // Raw markdown content without frontmatter
	};
}

export function parseDocument(content: string): Document {
	const { frontmatter, content: body } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		title: String(frontmatter.title || ""),
		type: String(frontmatter.type || "other") as Document["type"],
		createdDate: normalizeDate(frontmatter.created_date),
		updatedDate: frontmatter.updated_date ? normalizeDate(frontmatter.updated_date) : undefined,
		body: body,
		tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : undefined,
	};
}

function extractAcceptanceCriteria(content: string): string[] {
	const criteriaSection = extractSection(content, "Acceptance Criteria");
	if (!criteriaSection) return [];

	return criteriaSection
		.split("\n")
		.filter((line) => line.trim().startsWith("- [ ]") || line.trim().startsWith("- [x]"))
		.map((line) => line.trim().replace(/^- \[[ x]] /, ""));
}

function extractSection(content: string, sectionTitle: string): string | undefined {
	// Normalize to LF for reliable matching across platforms
	const src = content.replace(/\r\n/g, "\n");
	const regex = new RegExp(`## ${sectionTitle}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
	const match = src.match(regex);
	return match?.[1]?.trim();
}
