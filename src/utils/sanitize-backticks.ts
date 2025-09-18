/**
 * Dirty hack to clean up common command substitution accidents
 * When users accidentally have `backlog init` execute, we detect and clean it
 */

// Pattern to detect if backlog commands were accidentally executed
const BACKLOG_COMMAND_OUTPUT =
	/^(backlog\s+(init|task|board|config|draft|open|log|sync|archive|delete|update|move|comment)[\s\S]*)/i;

// Pattern to detect common interactive prompt outputs
const PROMPT_PATTERNS = [/Select .+:/i, /Choose .+:/i, /Enter .+:/i, /Which .+ would you like/i, /Please select/i];

export function sanitizeBackticks(text: string | undefined): string | undefined {
	if (!text) return text;

	// Check if the text contains output from a backlog command
	if (BACKLOG_COMMAND_OUTPUT.test(text)) {
		// Replace the entire command output with a placeholder message
		return "[backticks were here but command was executed - please use single quotes to include literal backticks]";
	}

	// Check for interactive prompt patterns
	for (const pattern of PROMPT_PATTERNS) {
		if (pattern.test(text)) {
			return "[command substitution detected - please escape backticks]";
		}
	}

	return text;
}

export function sanitizeOptions(options: Record<string, any>): Record<string, any> {
	const sanitized = { ...options };

	// Sanitize string options that might contain command substitution results
	const fieldsToSanitize = [
		"description",
		"desc",
		"plan",
		"notes",
		"ac",
		"acceptanceCriteria",
		"title",
		"label",
		"labels",
		"addLabel",
		"removeLabel",
		"appendNotes",
	];

	for (const field of fieldsToSanitize) {
		if (sanitized[field]) {
			if (typeof sanitized[field] === "string") {
				sanitized[field] = sanitizeBackticks(sanitized[field]);
			} else if (Array.isArray(sanitized[field])) {
				sanitized[field] = sanitized[field].map((item: any) =>
					typeof item === "string" ? sanitizeBackticks(item) : item,
				);
			}
		}
	}

	return sanitized;
}
