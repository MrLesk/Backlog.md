export const AUTOMATIC_COMMIT_MESSAGE_REGION_START = "Backlog-Operations-v2:";
export const AUTOMATIC_COMMIT_MESSAGE_REGION_END = "Backlog-Operations-End";
const LEGACY_AUTOMATIC_COMMIT_MESSAGE_REGION_START = "Backlog-Operations-v1:";

const SUBJECT_BUDGET = 72;

export type AutomaticCommitOperation = {
	verb: string;
	entity: string;
	identifiers: string[];
	message: string;
};

export type AutomaticCommitMessage = {
	message: string;
	operations: AutomaticCommitOperation[];
};

function normalizeMessage(message: string): string {
	return message.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

function operationSubject(operation: AutomaticCommitOperation): string {
	return operation.message.split("\n", 1)[0]?.trim() ?? "";
}

function normalizeEntity(entity: string): string {
	return entity.trim().toLowerCase().replace(/s$/, "");
}

export function createAutomaticCommitOperation(
	message: string,
	verb: string,
	entity: string,
	identifiers: readonly string[],
): AutomaticCommitOperation {
	return {
		verb: verb.trim(),
		entity: normalizeEntity(entity),
		identifiers: identifiers.map((identifier) => identifier.trim()).filter(Boolean),
		message: normalizeMessage(message),
	};
}

function parseLegacyOperation(message: string): AutomaticCommitOperation {
	const normalizedMessage = normalizeMessage(message);
	const subject = normalizedMessage.split("\n", 1)[0]?.trim() ?? "";
	const withoutPrefix = subject.replace(/^backlog:\s*/i, "").replace(/^\S+\s+-\s+/, "");
	const match = withoutPrefix.match(/^([A-Za-z]+)\s+([A-Za-z]+)\s+(.+)$/);
	if (!match?.[1] || !match[2] || !match[3]) {
		return createAutomaticCommitOperation(normalizedMessage, "Change", "change", [subject]);
	}
	return createAutomaticCommitOperation(normalizedMessage, match[1], match[2], [match[3]]);
}

function normalizeOperation(operation: AutomaticCommitOperation | string): AutomaticCommitOperation {
	if (typeof operation === "string") return parseLegacyOperation(operation);
	return createAutomaticCommitOperation(operation.message, operation.verb, operation.entity, operation.identifiers);
}

function normalizeOperations(
	input: AutomaticCommitOperation | string | readonly (AutomaticCommitOperation | string)[],
): AutomaticCommitOperation[] {
	return (Array.isArray(input) ? input : [input]).map(normalizeOperation);
}

function isValidOperation(operation: AutomaticCommitOperation): boolean {
	return Boolean(
		operation.verb &&
			operation.entity &&
			operation.identifiers.length > 0 &&
			operation.identifiers.every(Boolean) &&
			operationSubject(operation),
	);
}

function pluralize(entity: string): string {
	return entity.endsWith("s") ? entity : `${entity}s`;
}

function formatFactoredSubject(operations: readonly AutomaticCommitOperation[]): string {
	const first = operations[0];
	const prefix = `backlog: ${first?.verb ?? "Update"} ${pluralize(first?.entity ?? "change")} `;
	const identifiers = Array.from(new Set(operations.flatMap((operation) => operation.identifiers)));
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

export function formatAutomaticCommitSubject(operationInputs: readonly (AutomaticCommitOperation | string)[]): string {
	const operations = operationInputs.map(normalizeOperation);
	if (operations.length === 0) return "backlog: 0 changes";
	if (operations.length === 1) return operationSubject(operations[0] as AutomaticCommitOperation);

	const first = operations[0];
	if (
		first &&
		operations.every(
			(operation) =>
				operation.verb === first.verb && normalizeEntity(operation.entity) === normalizeEntity(first.entity),
		)
	) {
		return formatFactoredSubject(operations);
	}
	return `backlog: ${operations.length} changes`;
}

function parseOperations(lines: readonly string[], legacy: boolean): AutomaticCommitOperation[] | null {
	const operations: AutomaticCommitOperation[] = [];
	for (const line of lines) {
		if (!line.startsWith("- ")) return null;
		try {
			const parsed: unknown = JSON.parse(line.slice(2));
			if (legacy) {
				if (typeof parsed !== "string" || !parsed.trim()) return null;
				operations.push(parseLegacyOperation(parsed));
				continue;
			}
			if (!parsed || typeof parsed !== "object") return null;
			const candidate = parsed as Partial<AutomaticCommitOperation>;
			if (
				typeof candidate.verb !== "string" ||
				typeof candidate.entity !== "string" ||
				!Array.isArray(candidate.identifiers) ||
				!candidate.identifiers.every((identifier) => typeof identifier === "string") ||
				typeof candidate.message !== "string"
			) {
				return null;
			}
			const operation = normalizeOperation(candidate as AutomaticCommitOperation);
			if (!isValidOperation(operation)) return null;
			operations.push(operation);
		} catch {
			return null;
		}
	}
	return operations.length > 0 ? operations : null;
}

function renderMessage(
	subject: string,
	bodyBefore: readonly string[],
	operations: readonly AutomaticCommitOperation[],
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
 * Builds the message for an owned automatic commit or replaces its one
 * Backlog-owned region. Existing text outside the region is retained
 * line-for-line. Missing, duplicated, out-of-order, or malformed markers fail
 * closed by returning null. Version-one string regions are migrated on rewrite.
 */
export function buildAutomaticCommitMessage(
	operationInput: AutomaticCommitOperation | string | readonly (AutomaticCommitOperation | string)[],
	previousMessage?: string,
): AutomaticCommitMessage | null {
	const inputOperations = normalizeOperations(operationInput);
	if (inputOperations.length === 0 || !inputOperations.every(isValidOperation)) return null;

	if (previousMessage === undefined) {
		const inputLines = inputOperations[0]?.message.split("\n") ?? [];
		const bodyBefore = inputLines.length > 1 ? ["", ...inputLines.slice(1), ""] : [""];
		return {
			message: renderMessage(formatAutomaticCommitSubject(inputOperations), bodyBefore, inputOperations, []),
			operations: inputOperations,
		};
	}

	const previousLines = previousMessage.replace(/\r\n/g, "\n").split("\n");
	const startIndexes = previousLines.flatMap((line, index) =>
		line === AUTOMATIC_COMMIT_MESSAGE_REGION_START || line === LEGACY_AUTOMATIC_COMMIT_MESSAGE_REGION_START
			? [index]
			: [],
	);
	const endIndexes = previousLines.flatMap((line, index) =>
		line === AUTOMATIC_COMMIT_MESSAGE_REGION_END ? [index] : [],
	);
	if (startIndexes.length !== 1 || endIndexes.length !== 1) return null;
	const start = startIndexes[0] ?? -1;
	const end = endIndexes[0] ?? -1;
	if (start <= 0 || end <= start + 1) return null;

	const legacy = previousLines[start] === LEGACY_AUTOMATIC_COMMIT_MESSAGE_REGION_START;
	const existingOperations = parseOperations(previousLines.slice(start + 1, end), legacy);
	if (!existingOperations) return null;
	const operations = [...existingOperations];
	for (const operation of inputOperations) {
		const operationKey = JSON.stringify(operation);
		if (!operations.some((existing) => JSON.stringify(existing) === operationKey)) operations.push(operation);
	}
	const subject = formatAutomaticCommitSubject(operations);
	const bodyBefore = previousLines.slice(1, start);
	const bodyAfter = previousLines.slice(end + 1);
	return { message: renderMessage(subject, bodyBefore, operations, bodyAfter), operations };
}
