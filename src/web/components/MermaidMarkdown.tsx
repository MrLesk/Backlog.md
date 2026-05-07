import React, { useEffect, useRef } from "react";
import MDEditor from "@uiw/react-md-editor";
import { renderMermaidIn } from "../utils/mermaid";
import { apiClient } from "../lib/api";

interface Props {
	source: string;
	onFileClick?: (path: string) => void;
}

const URI_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\u0000-\u0020]*>/;
const EMAIL_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+>/;

function sanitizeMarkdownSource(source: string): string {
	return source.replace(/<(?=[A-Za-z])/g, (match, offset, fullText) => {
		const remaining = fullText.slice(offset);
		if (URI_AUTOLINK_PREFIX_REGEX.test(remaining) || EMAIL_AUTOLINK_PREFIX_REGEX.test(remaining)) {
			return match;
		}
		return "&lt;";
	});
}

function isExternalLink(href?: string): boolean {
	if (!href) return true;
	if (href.startsWith("#")) return false;
	if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return true;
	return false;
}

export default function MermaidMarkdown({ source, onFileClick }: Props) {
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

	const LinkComponent = React.useCallback(
		({ href, children }: { href?: string; children?: React.ReactNode }) => {
			if (isExternalLink(href)) {
				return (
					<a href={href} target="_blank" rel="noopener noreferrer">
						{children}
					</a>
				);
			}

			if (!onFileClick) {
				return <a href={href}>{children}</a>;
			}

			const handleClick = async (e: React.MouseEvent) => {
				e.preventDefault();
				if (!href) return;
				try {
					// Verify file exists before opening preview
					await apiClient.fetchFileContent(href);
					onFileClick(href);
				} catch {
					// File not found or inaccessible: fall back to normal link behavior
					window.open(href, "_blank");
				}
			};

			return (
				<a
					href={href}
					onClick={handleClick}
					className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
					title="Click to preview file"
				>
					{children}
				</a>
			);
		},
		[onFileClick],
	);

	return (
		<div ref={ref} className="wmde-markdown">
			<MDEditor.Markdown source={safeSource} components={{ a: LinkComponent }} />
		</div>
	);
}
