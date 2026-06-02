interface TypableElement {
	tagName: string;
	isContentEditable: boolean;
}

/**
 * Determine whether a keyboard event originated while the user is typing
 * into a text-input element (input, textarea, or contenteditable).
 */
export function isTypingTarget(event: KeyboardEvent): boolean {
	const target = event.target as unknown;
	if (!target || typeof target !== "object") return false;

	const el = target as TypableElement;
	const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";

	if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) {
		return true;
	}

	return false;
}
