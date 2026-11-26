import { type ComponentProps, type MouseEvent, useEffect, useMemo, useRef } from "react";
import MDEditor from "@uiw/react-md-editor";
import { useBrowserAccess } from "../contexts/BrowserAccessContext";
import { useTaskIdIndex } from "../contexts/TaskIdIndexContext";
import { renderMermaidIn } from "../utils/mermaid";
import { createTaskIdLinkPlugin, resolveTaskReference } from "../utils/task-id-links";
import TaskLink from "./TaskLink";

interface Props {
	source: string;
	openExternalLinksInNewTab?: boolean;
}

/**
 * Remark plugin that switches HTML syntax off in the Markdown parser, so tag-like text such
 * as `<repo>` is always plain text and the preview shows it as written, in prose and in code alike.
 *
 * This is also what keeps HTML in Markdown files inert. The preview library turns any HTML
 * the parser reports into real elements, and its `skipHtml` option does not switch that step
 * off, so `<script>`, `<img onerror=...>` and type strings such as `Result<List<MenuItem>>`
 * must never be reported as HTML. Autolinks (`<https://example.com>`, `<user@example.com>`)
 * are separate Markdown syntax and still link.
 * Mermaid diagrams are drawn from code blocks afterwards; `renderMermaidIn` keeps HTML out of those.
 */
function treatHtmlAsText(this: { data(): object }): void {
	// The processor's shared settings, where the Markdown parser looks up its extensions.
	const settings: { micromarkExtensions?: unknown[] } = this.data();
	settings.micromarkExtensions ??= [];
	// "htmlFlow" is block-level HTML and "htmlText" is inline HTML in micromark, the parser behind remark.
	settings.micromarkExtensions.push({ disable: { null: ["htmlFlow", "htmlText"] } });
}

function keepHashLinksInCurrentRoute(url: string, key: string): string {
	if (key !== "href" || !url.startsWith("#") || typeof window === "undefined") {
		return url;
	}

	return `${window.location.pathname}${window.location.search}${url}`;
}

function publishedLinkUrl(url: string, key: string): string {
	if (url.startsWith("/assets/")) return `.${url}`;
	if (key === "href" && /^\/(?:tasks|board|documentation|decisions|milestones|statistics)(?:[/?#]|$)/.test(url)) {
		return `#${url}`;
	}
	return url;
}

// The URL fragment holds the published route. A Markdown heading still scrolls within that route.
function openPublishedHeading(event: MouseEvent<HTMLDivElement>) {
	const href = (event.target as Element).closest("a[href]")?.getAttribute("href");
	if (!href?.startsWith("#") || href.startsWith("#/")) return;
	event.preventDefault();
	document.getElementById(href.slice(1))?.scrollIntoView();
}

function isExternalWebLink(href: string | undefined): boolean {
	if (!href || typeof window === "undefined") return false;
	try {
		const url = new URL(href, window.location.href);
		return (url.protocol === "https:" || url.protocol === "http:") && url.origin !== window.location.origin;
	} catch {
		return false;
	}
}

type MarkdownLinkProps = ComponentProps<"a"> & { node?: unknown; "data-task-id"?: string };

function MarkdownLink({
	node: _node,
	openExternalLinksInNewTab,
	...props
}: MarkdownLinkProps & { openExternalLinksInNewTab?: boolean }) {
	const index = useTaskIdIndex();
	const taskId = props["data-task-id"];
	const task = taskId ? resolveTaskReference(index, taskId) : undefined;
	if (task) {
		const { href: _href, ...linkProps } = props;
		return <TaskLink {...linkProps} task={task} />;
	}
	if (!openExternalLinksInNewTab || !isExternalWebLink(props.href)) return <a {...props} />;
	return (
		<a {...props} target="_blank" rel="noopener noreferrer">
			{props.children}
			<span aria-hidden="true" title="Opens in a new tab"> ↗</span>
			<span className="sr-only"> (opens in a new tab)</span>
		</a>
	);
}

const MARKDOWN_COMPONENTS = { a: MarkdownLink };
const TASK_MARKDOWN_COMPONENTS = {
	a: (props: MarkdownLinkProps) => <MarkdownLink {...props} openExternalLinksInNewTab />,
};

export default function MermaidMarkdown({ source, openExternalLinksInNewTab = false }: Props) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { canWrite } = useBrowserAccess();
	const taskIdIndex = useTaskIdIndex();
	const remarkPlugins = useMemo(() => [treatHtmlAsText, createTaskIdLinkPlugin(taskIdIndex)], [taskIdIndex]);

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
	}, [source]);

	return (
		<div ref={ref} className="wmde-markdown" onClick={canWrite ? undefined : openPublishedHeading}>
			<MDEditor.Markdown
				source={source}
				urlTransform={canWrite ? keepHashLinksInCurrentRoute : publishedLinkUrl}
				remarkPlugins={remarkPlugins}
				components={openExternalLinksInNewTab ? TASK_MARKDOWN_COMPONENTS : MARKDOWN_COMPONENTS}
			/>
		</div>
	);
}
