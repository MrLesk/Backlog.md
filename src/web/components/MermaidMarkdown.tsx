import { useEffect, useRef } from "react";
import MDEditor from "@uiw/react-md-editor";
import { renderMermaidIn } from "../utils/mermaid";

interface Props {
	source: string;
}

const URI_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\u0000-\u0020]*>/;
const EMAIL_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+>/;
const TASK_ID_REGEX = /\b([a-zA-Z]+-\d+(?:\.\d+)*)\b/g;

function sanitizeMarkdownSource(source: string): string {
	let processed = source.replace(/<(?=[A-Za-z])/g, (match, offset, fullText) => {
		const remaining = fullText.slice(offset);
		if (URI_AUTOLINK_PREFIX_REGEX.test(remaining) || EMAIL_AUTOLINK_PREFIX_REGEX.test(remaining)) {
			return match;
		}
		return "&lt;";
	});

	// Auto-link task IDs (e.g., TASK-123, BACK-456, TASK-358.8)
	processed = processed.replace(TASK_ID_REGEX, (match, _id, offset, fullText) => {
		const before = fullText.slice(Math.max(0, offset - 2), offset);
		const after = fullText.slice(offset + match.length, offset + match.length + 2);

		if (before === "](" || before === "(#" || (before.startsWith("[") && after.endsWith("]"))) {
			return match;
		}

		// Avoid linking if inside a code block or backticks (odd number of backticks on line)
		const lines = fullText.slice(0, offset).split("\n");
		const currentLine = lines[lines.length - 1] || "";
		const backtickCount = (currentLine.match(/`/g) || []).length;
		if (backtickCount % 2 !== 0) {
			return match;
		}

		return `[${match}](/tasks/${match})`;
	});

	return processed;
}

function keepHashLinksInCurrentRoute(url: string, key: string): string {
	if (key !== "href" || !url.startsWith("#") || typeof window === "undefined") {
		return url;
	}

	return `${window.location.pathname}${window.location.search}${url}`;
}

export default function MermaidMarkdown({ source }: Props) {
	const ref = useRef<HTMLDivElement | null>(null);
	const safeSource = sanitizeMarkdownSource(source);

	useEffect(() => {
		if (!ref.current) return;

		// Render mermaid diagrams after the markdown has been rendered
		// Use requestAnimationFrame to ensure MDEditor has finished rendering
		const frameId = requestAnimationFrame(() => {
			if (ref.current) {
				void renderMermaidIn(ref.current);
			}
		});

		return () => cancelAnimationFrame(frameId);
	}, [safeSource]);

	return (
		<div ref={ref} className="wmde-markdown">
			<MDEditor.Markdown source={safeSource} urlTransform={keepHashLinksInCurrentRoute} />
		</div>
	);
}
