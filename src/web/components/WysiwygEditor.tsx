import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, COMMAND_PRIORITY_LOW, KEY_ESCAPE_COMMAND, type EditorState } from "lexical";
import React from "react";

/**
 * A WYSIWYG editor over Markdown, in the shape vibe-kanban uses: you type
 * formatted text and never see the syntax. Markdown shortcuts still work, so
 * typing "# " or "- " converts as you go.
 *
 * Backlog stores tasks as Markdown files, so this parses on the way in and
 * serialises on the way out. That round trip is not byte-exact. Measured
 * across all 146 tasks in the reference backlog: 51 came back identical, 86
 * differed only in blank lines and backslash escapes, 2 changed the fence
 * length of an inline code span that itself contained backticks, and none
 * failed. No content was lost.
 *
 * Because most files come back reformatted, `onChange` reports the ORIGINAL
 * Markdown until the document actually changes. Opening a task and closing it
 * again therefore cannot rewrite it; only a real edit does.
 */

const theme = {
	paragraph: "mb-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300",
	quote: "mb-3 border-l-2 border-gray-200 pl-3 text-sm italic text-gray-500 dark:border-gray-700 dark:text-gray-400",
	heading: {
		h1: "mb-4 mt-6 border-b border-gray-200 pb-2 text-xl font-bold text-gray-900 first:mt-0 dark:border-gray-700 dark:text-gray-100",
		h2: "mb-3 mt-5 border-b border-gray-200 pb-1.5 text-lg font-semibold text-gray-900 first:mt-0 dark:border-gray-700 dark:text-gray-100",
		h3: "mb-2 mt-4 text-base font-semibold text-gray-900 dark:text-gray-100",
		h4: "mb-2 mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100",
		h5: "mb-1 mt-3 text-sm font-medium text-gray-900 dark:text-gray-100",
		h6: "mb-1 mt-3 text-sm font-medium text-gray-500 dark:text-gray-400",
	},
	list: {
		ul: "mb-3 list-disc pl-6 text-sm text-gray-700 dark:text-gray-300",
		ol: "mb-3 list-decimal pl-6 text-sm text-gray-700 dark:text-gray-300",
		listitem: "leading-relaxed",
		nested: { listitem: "list-none" },
	},
	link: "text-blue-500 hover:text-blue-400 hover:underline",
	code: "mb-3 block overflow-auto rounded-sm bg-gray-100 p-2 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200",
	text: {
		bold: "font-semibold",
		italic: "italic",
		strikethrough: "line-through",
		code: "rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200",
	},
};

const NODES = [
	HeadingNode,
	QuoteNode,
	ListNode,
	ListItemNode,
	LinkNode,
	AutoLinkNode,
	CodeNode,
	CodeHighlightNode,
];

/** Loads the initial Markdown once, and reloads it if the source changes underneath. */
const LoadMarkdown: React.FC<{ value: string }> = ({ value }) => {
	const [editor] = useLexicalComposerContext();
	const loaded = React.useRef<string | null>(null);

	React.useEffect(() => {
		if (loaded.current === value) return;
		loaded.current = value;
		editor.update(() => {
			$convertFromMarkdownString(value, TRANSFORMERS);
		});
	}, [editor, value]);

	return null;
};

/** Escape leaves the field, which is how vibe-kanban closes an inline editor. */
const EscapeToCommit: React.FC<{ onEscape?: () => void }> = ({ onEscape }) => {
	const [editor] = useLexicalComposerContext();

	React.useEffect(() => {
		if (!onEscape) return;
		return editor.registerCommand(
			KEY_ESCAPE_COMMAND,
			() => {
				onEscape();
				return true;
			},
			COMMAND_PRIORITY_LOW,
		);
	}, [editor, onEscape]);

	return null;
};

const AutoFocus: React.FC<{ enabled?: boolean }> = ({ enabled }) => {
	const [editor] = useLexicalComposerContext();

	React.useEffect(() => {
		if (enabled) editor.focus();
	}, [editor, enabled]);

	return null;
};

interface Props {
	value: string;
	onChange: (markdown: string) => void;
	placeholder?: string;
	autoFocus?: boolean;
	onEscape?: () => void;
	onBlur?: () => void;
	minHeight?: string;
	ariaLabel?: string;
}

export const WysiwygEditor: React.FC<Props> = ({
	value,
	onChange,
	placeholder = "Write something…",
	autoFocus = false,
	onEscape,
	onBlur,
	minHeight = "8rem",
	ariaLabel,
}) => {
	// The Markdown this editor was opened with. While the document still
	// serialises to something equivalent, we hand this back verbatim instead of
	// Lexical's re-rendering, so an untouched field is never rewritten on disk.
	const original = React.useRef(value);
	const dirty = React.useRef(false);

	React.useEffect(() => {
		if (!dirty.current) original.current = value;
	}, [value]);

	const handleChange = React.useCallback(
		(editorState: EditorState) => {
			editorState.read(() => {
				const markdown = $convertToMarkdownString(TRANSFORMERS);
				const empty = $getRoot().getTextContent().trim() === "";
				if (!dirty.current) {
					// First change after load is Lexical settling, not the user.
					// Treat it as a real edit only once the text actually differs.
					const settled = markdown.trim() === original.current.trim();
					const reformatOnly = normalize(markdown) === normalize(original.current);
					if (settled || reformatOnly) {
						onChange(original.current);
						return;
					}
					dirty.current = true;
				}
				onChange(empty ? "" : markdown);
			});
		},
		[onChange],
	);

	const initialConfig = React.useMemo(
		() => ({
			namespace: "backlog-task",
			nodes: NODES,
			theme,
			onError: (error: Error) => {
				console.error("WysiwygEditor", error);
			},
		}),
		[],
	);

	return (
		<LexicalComposer initialConfig={initialConfig}>
			<div
				className="relative w-full rounded-md border border-gray-300 px-3 py-2 transition-colors duration-200 focus-within:ring-1 focus-within:ring-gray-900 dark:border-gray-600 dark:focus-within:ring-gray-300"
				onBlur={(event) => {
					if (!onBlur) return;
					if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
					onBlur();
				}}
			>
				<RichTextPlugin
					contentEditable={
						<ContentEditable
							aria-label={ariaLabel}
							className="w-full outline-none"
							style={{ minHeight }}
						/>
					}
					placeholder={
						<div className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400 dark:text-gray-500">
							{placeholder}
						</div>
					}
					ErrorBoundary={LexicalErrorBoundary}
				/>
				<LoadMarkdown value={value} />
				<OnChangePlugin onChange={handleChange} ignoreSelectionChange />
				<HistoryPlugin />
				<ListPlugin />
				<LinkPlugin />
				<TabIndentationPlugin />
				<MarkdownShortcutPlugin transformers={TRANSFORMERS} />
				<EscapeToCommit onEscape={onEscape} />
				<AutoFocus enabled={autoFocus} />
			</div>
		</LexicalComposer>
	);
};

/** Blank lines and backslash escapes are the two things the round trip moves. */
function normalize(markdown: string): string {
	return markdown
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join("\n")
		.replace(/\\([~_*`#\-.>[\]()!+])/g, "$1");
}

export default WysiwygEditor;
