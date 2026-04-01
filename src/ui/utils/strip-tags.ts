type TagState = {
	name: string;
	strip: boolean;
};

function parseOpenTag(tag: string): string | null {
	if (!tag.startsWith("{") || !tag.endsWith("}") || tag.startsWith("{/")) {
		return null;
	}

	return tag.slice(1, -1).trim() || null;
}

function parseCloseTag(tag: string): string | null {
	if (tag === "{/}") {
		return "";
	}

	if (!tag.startsWith("{/") || !tag.endsWith("}")) {
		return null;
	}

	return tag.slice(2, -1).trim();
}

function isForegroundTag(name: string): boolean {
	return name.endsWith("-fg");
}

export function stripBlessedFgTags(value: string): string {
	if (!value.includes("{")) {
		return value;
	}

	const tagPattern = /\{\/?[^{}]+\}|\{\/\}/g;
	const stack: TagState[] = [];
	let cursor = 0;
	let output = "";

	for (const match of value.matchAll(tagPattern)) {
		const tag = match[0];
		const start = match.index ?? 0;
		output += value.slice(cursor, start);
		cursor = start + tag.length;

		const closeTag = parseCloseTag(tag);
		if (closeTag !== null) {
			const openTag = stack.pop();
			if (!openTag) {
				output += tag;
				continue;
			}

			if (closeTag && closeTag !== openTag.name) {
				stack.push(openTag);
				output += tag;
				continue;
			}

			if (!openTag.strip) {
				output += tag;
			}
			continue;
		}

		const openTagName = parseOpenTag(tag);
		if (!openTagName) {
			output += tag;
			continue;
		}

		const strip = isForegroundTag(openTagName);
		stack.push({ name: openTagName, strip });
		if (!strip) {
			output += tag;
		}
	}

	output += value.slice(cursor);
	return output;
}
