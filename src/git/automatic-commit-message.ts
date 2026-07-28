export const AUTOMATIC_COMMIT_MESSAGE_REGION_START = "Backlog-Operations-v1:";
export const AUTOMATIC_COMMIT_MESSAGE_REGION_END = "Backlog-Operations-End";

const SUBJECT_BUDGET = 72;

type ParsedOperationSubject = {
	verb: string;
	entity: string;
	identifier: string;
};

export type AutomaticCommitMessage = {
	message: string;
	operations: string[];
};

function normalizeOperation(message: string): string {
	return message.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

function operationSubject(operation: string): string {
	return operation.split("\n", 1)[0]?.trim() ?? "";
}

function parseOperationSubject(operation: string): ParsedOperationSubject | null {
	const subject = operationSubject(operation).replace(/^backlog:\s*/i, "");
	const match = subject.match(/^([A-Za-z]+)\s+([A-Za-z]+)\s+(.+)$/);
	if (!match?.[1] || !match[2] || !match[3]) return null;
	return {
		verb: match[1],
		entity: match[2].toLowerCase().replace(/s$/, ""),
		identifier: match[3].trim(),
	};
}

function pluralize(entity: string): string {
	return entity.endsWith("s") ? entity : `${entity}s`;
}

function formatFactoredSubject(parsed: ParsedOperationSubject[]): string {
	const prefix = `backlog: ${parsed[0]?.verb ?? "Update"} ${pluralize(parsed[0]?.entity ?? "change")} `;
	const identifiers = parsed.map((operation) => operation.identifier);
	for (let count = identifiers.length; count >= 1; count -= 1) {
		const remaining = identifiers.length - count;
		const suffix = remaining > 0 ? ` +${remaining} more` : "";
		const subject = `${prefix}${identifiers.slice(0, count).join(", ")}${suffix}`;
		if (subject.length <= SUBJECT_BUDGET) return subject;
	}

	const suffix = identifiers.length > 1 ? ` +${identifiers.length - 1} more` : "";
	const available = Math.max(1, SUBJECT_BUDGET - prefix.length - suffix.length - 1);
	return `${prefix}${identifiers[0]?.slice(0, available) ?? ""}…${suffix}`.slice(0, SUBJECT_BUDGET);
}

export function formatAutomaticCommitSubject(operations: readonly string[]): string {
	if (operations.length === 0) return "backlog: 0 changes";
	if (operations.length === 1) return operationSubject(operations[0] ?? "");

	const parsed = operations.map(parseOperationSubject);
	const first = parsed[0];
	if (first && parsed.every((operation) => operation?.verb === first.verb && operation.entity === first.entity)) {
		return formatFactoredSubject(parsed as ParsedOperationSubject[]);
	}
	return `backlog: ${operations.length} changes`;
}

function parseOperations(lines: readonly string[]): string[] | null {
	const operations: string[] = [];
	for (const line of lines) {
		if (!line.startsWith("- ")) return null;
		try {
			const operation = JSON.parse(line.slice(2));
			if (typeof operation !== "string" || !operation.trim()) return null;
			operations.push(normalizeOperation(operation));
		} catch {
			return null;
		}
	}
	return operations.length > 0 ? operations : null;
}

function renderMessage(
	subject: string,
	bodyBefore: readonly string[],
	operations: readonly string[],
	bodyAfter: readonly string[],
): string {
	const message = [
		subject,
		...bodyBefore,
		AUTOMATIC_COMMIT_MESSAGE_REGION_START,
		...operations.map((operation) => `- ${JSON.stringify(operation)}`),
		AUTOMATIC_COMMIT_MESSAGE_REGION_END,
		...bodyAfter,
	].join("\n");
	return message.endsWith("\n") ? message : `${message}\n`;
}

/**
 * Builds the message for a new automatic commit or replaces the one Backlog-owned
 * region in an existing message. Existing text outside the region is retained
 * line-for-line. Missing, duplicated, out-of-order, or malformed region markers
 * fail closed by returning null.
 */
export function buildAutomaticCommitMessage(
	operationMessage: string,
	previousMessage?: string,
): AutomaticCommitMessage | null {
	const operation = normalizeOperation(operationMessage);
	if (!operationSubject(operation)) return null;

	if (previousMessage === undefined) {
		const inputLines = operation.split("\n");
		const bodyBefore = inputLines.length > 1 ? ["", ...inputLines.slice(1), ""] : [""];
		return {
			message: renderMessage(operationSubject(operation), bodyBefore, [operation], []),
			operations: [operation],
		};
	}

	const previousLines = previousMessage.replace(/\r\n/g, "\n").split("\n");
	const startIndexes = previousLines.flatMap((line, index) =>
		line === AUTOMATIC_COMMIT_MESSAGE_REGION_START ? [index] : [],
	);
	const endIndexes = previousLines.flatMap((line, index) =>
		line === AUTOMATIC_COMMIT_MESSAGE_REGION_END ? [index] : [],
	);
	if (startIndexes.length !== 1 || endIndexes.length !== 1) return null;
	const start = startIndexes[0] ?? -1;
	const end = endIndexes[0] ?? -1;
	if (start <= 0 || end <= start + 1) return null;

	const existingOperations = parseOperations(previousLines.slice(start + 1, end));
	if (!existingOperations) return null;
	const operations = [...existingOperations];
	if (!operations.includes(operation)) operations.push(operation);
	const subject = formatAutomaticCommitSubject(operations);
	const bodyBefore = previousLines.slice(1, start);
	const bodyAfter = previousLines.slice(end + 1);
	return { message: renderMessage(subject, bodyBefore, operations, bodyAfter), operations };
}
