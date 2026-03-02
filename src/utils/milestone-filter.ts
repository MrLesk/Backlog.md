export function normalizeMilestoneFilterValue(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function compactMilestoneValue(value: string): string {
	return value.replace(/\s+/g, "");
}

function levenshteinDistance(left: string, right: string): number {
	if (left === right) return 0;
	if (left.length === 0) return right.length;
	if (right.length === 0) return left.length;

	const previous = new Array<number>(right.length + 1);
	const current = new Array<number>(right.length + 1);

	for (let column = 0; column <= right.length; column += 1) {
		previous[column] = column;
	}

	for (let row = 1; row <= left.length; row += 1) {
		current[0] = row;
		const leftChar = left[row - 1];
		for (let column = 1; column <= right.length; column += 1) {
			const rightChar = right[column - 1];
			const substitutionCost = leftChar === rightChar ? 0 : 1;
			current[column] = Math.min(
				(current[column - 1] ?? Number.MAX_SAFE_INTEGER) + 1,
				(previous[column] ?? Number.MAX_SAFE_INTEGER) + 1,
				(previous[column - 1] ?? Number.MAX_SAFE_INTEGER) + substitutionCost,
			);
		}
		for (let column = 0; column <= right.length; column += 1) {
			previous[column] = current[column] ?? Number.MAX_SAFE_INTEGER;
		}
	}

	return previous[right.length] ?? Number.MAX_SAFE_INTEGER;
}

function compareRank(left: number[], right: number[]): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const leftValue = left[index] ?? 0;
		const rightValue = right[index] ?? 0;
		if (leftValue < rightValue) return -1;
		if (leftValue > rightValue) return 1;
	}
	return 0;
}

function isSubsequence(query: string, candidate: string): boolean {
	if (!query) return true;
	let queryIndex = 0;
	for (const char of candidate) {
		if (char === query[queryIndex]) {
			queryIndex += 1;
			if (queryIndex >= query.length) {
				return true;
			}
		}
	}
	return false;
}

function buildCandidateRank(queryCompact: string, candidateCompact: string): number[] {
	const prefixMatch = candidateCompact.startsWith(queryCompact) || queryCompact.startsWith(candidateCompact);
	const containsMatch = candidateCompact.includes(queryCompact) || queryCompact.includes(candidateCompact);
	const subsequenceMatch =
		isSubsequence(queryCompact, candidateCompact) || isSubsequence(candidateCompact, queryCompact);
	const distance = levenshteinDistance(queryCompact, candidateCompact);
	const maxLength = Math.max(queryCompact.length, candidateCompact.length) || 1;
	const normalizedDistance = Math.round((distance / maxLength) * 1000);
	return [
		prefixMatch ? 0 : 1,
		containsMatch ? 0 : 1,
		subsequenceMatch ? 0 : 1,
		normalizedDistance,
		distance,
		Math.abs(candidateCompact.length - queryCompact.length),
	];
}

export function resolveClosestMilestoneFilterValue(query: string, milestoneValues: string[]): string {
	const normalizedQuery = normalizeMilestoneFilterValue(query);
	if (!normalizedQuery) {
		return normalizedQuery;
	}

	const normalizedCandidates = Array.from(
		new Set(milestoneValues.map((value) => normalizeMilestoneFilterValue(value)).filter(Boolean)),
	).sort((left, right) => left.localeCompare(right));

	if (normalizedCandidates.length === 0) {
		return normalizedQuery;
	}

	if (normalizedCandidates.includes(normalizedQuery)) {
		return normalizedQuery;
	}

	const queryCompact = compactMilestoneValue(normalizedQuery);
	let bestCandidate = normalizedCandidates[0] ?? normalizedQuery;
	let bestRank = buildCandidateRank(queryCompact, compactMilestoneValue(bestCandidate));

	for (const candidate of normalizedCandidates.slice(1)) {
		const rank = buildCandidateRank(queryCompact, compactMilestoneValue(candidate));
		if (compareRank(rank, bestRank) < 0) {
			bestCandidate = candidate;
			bestRank = rank;
		}
	}

	return bestCandidate;
}
