import { useEffect, useRef } from "react";
import MDEditor from "@uiw/react-md-editor";
import { renderMermaidIn } from "../utils/mermaid";

interface Props {
	source: string;
}

function sanitizeMarkdownSource(source: string): string {
	return source.replace(/<(?=[A-Za-z])(?!https?:\/\/)(?!mailto:)/gi, "&lt;");
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
			<MDEditor.Markdown source={safeSource} />
		</div>
	);
}
