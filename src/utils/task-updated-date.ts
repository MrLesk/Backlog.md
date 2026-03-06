/**
 * Upsert the task updated_date field in markdown frontmatter while preserving body content.
 */
export function upsertTaskUpdatedDate(content: string, updatedDate: string): string {
	if (!content || !updatedDate) {
		return content;
	}

	const useCrlf = content.includes("\r\n");
	const normalized = content.replace(/\r\n/g, "\n");
	const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---(\n|$)/);
	if (!frontmatterMatch) {
		return content;
	}

	const frontmatterBody = frontmatterMatch[1] ?? "";
	const frontmatterStart = frontmatterMatch[0];
	const rest = normalized.slice(frontmatterStart.length);
	const lines = frontmatterBody.split("\n");

	let replaced = false;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line) continue;
		const match = line.match(/^(\s*)updated_date\s*:/);
		if (!match) continue;
		const indent = match[1] ?? "";
		lines[index] = `${indent}updated_date: '${updatedDate}'`;
		replaced = true;
		break;
	}

	if (!replaced) {
		const createdDateIndex = lines.findIndex((line) => /^\s*created_date\s*:/.test(line));
		const insertIndex = createdDateIndex >= 0 ? createdDateIndex + 1 : lines.length;
		lines.splice(insertIndex, 0, `updated_date: '${updatedDate}'`);
	}

	const updatedContent = `---\n${lines.join("\n")}\n---${rest}`;
	return useCrlf ? updatedContent.replace(/\n/g, "\r\n") : updatedContent;
}
