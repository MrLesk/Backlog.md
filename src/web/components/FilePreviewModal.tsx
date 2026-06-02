import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { apiClient } from "../lib/api";
import MermaidMarkdown from "./MermaidMarkdown";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";

interface Props {
	path: string;
	onClose: () => void;
}

const LANG_MAP: Record<string, string> = {
	ts: "typescript",
	tsx: "tsx",
	js: "javascript",
	jsx: "jsx",
	py: "python",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	css: "css",
	scss: "scss",
	html: "html",
	xml: "xml",
	sh: "bash",
	bash: "bash",
	zsh: "zsh",
	go: "go",
	rs: "rust",
	java: "java",
	cpp: "cpp",
	c: "c",
	cs: "csharp",
	php: "php",
	rb: "ruby",
	sql: "sql",
	dockerfile: "dockerfile",
	md: "markdown",
};

function getLanguage(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase() || "";
	return LANG_MAP[ext] || ext;
}

function wrapInCodeBlock(content: string, language: string): string {
	// Use longer fence if content contains triple backticks to avoid premature closing
	const hasCodeFence = /\n```/.test(content);
	const fence = hasCodeFence ? "````" : "```";
	return `${fence}${language}\n${content}\n${fence}`;
}

export const FilePreviewModal: React.FC<Props> = ({ path, onClose }) => {
	const { theme } = useTheme();
	const { t } = useI18n();
	const [content, setContent] = useState<string>("");
	const [filePath, setFilePath] = useState<string>("");
	const [lineStart, setLineStart] = useState<number | undefined>();
	const [lineEnd, setLineEnd] = useState<number | undefined>();
	const [totalLines, setTotalLines] = useState<number>(0);
	const [isMarkdown, setIsMarkdown] = useState<boolean>(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const data = await apiClient.fetchFileContent(path);
				if (cancelled) return;
				setContent(data.content);
				setFilePath(data.path);
				setLineStart(data.lineStart);
				setLineEnd(data.lineEnd);
				setTotalLines(data.totalLines);
				setIsMarkdown(data.isMarkdown);
			} catch (err) {
				if (cancelled) return;
				const message = err instanceof Error ? err.message : t.filePreview.failedToLoad;
				setError(message);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [path]);

	const titleParts = [filePath || path];
	if (lineStart !== undefined && lineEnd !== undefined) {
		titleParts.push(`(lines ${lineStart}-${lineEnd})`);
	} else if (lineStart !== undefined) {
		titleParts.push(`(line ${lineStart})`);
	}
	const title = titleParts.join(" ");

	const isPartial = lineStart !== undefined && lineEnd !== undefined;
	const startLineNumber = (lineStart ?? 1) - 1;

	return (
		<Modal isOpen onClose={onClose} title={title} maxWidthClass="max-w-4xl">
			{loading && <div className="text-sm text-gray-500 dark:text-gray-400">{t.filePreview.loading}</div>}
			{error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
			{!loading && !error && (
				<div className="space-y-2">
					<div className="text-xs text-gray-500 dark:text-gray-400">
						{t.filePreview.lineCountTotal.replace("{count}", String(totalLines))}
						{isPartial && (
							<span className="ml-2 text-blue-600 dark:text-blue-400">
								{t.filePreview.showingLines.replace("{start}", String(lineStart)).replace("{end}", String(lineEnd))}
							</span>
						)}
					</div>
					{isMarkdown ? (
						<div
							className="prose prose-sm !max-w-none wmde-markdown rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800"
							data-color-mode={theme}
						>
							<MermaidMarkdown source={content} />
						</div>
					) : (
						<div className="rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-auto">
							{isPartial && (
								<div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs px-4 py-1.5 border-b border-blue-200 dark:border-blue-800 sticky top-0 z-10">
									{t.filePreview.linesOfTotal.replace("{start}", String(lineStart)).replace("{end}", String(lineEnd)).replace("{total}", String(totalLines))}
								</div>
							)}
							<div
								className="code-file-preview"
								style={{ counterReset: `line ${startLineNumber}` }}
							>
								<MermaidMarkdown source={wrapInCodeBlock(content, getLanguage(filePath))} />
							</div>
						</div>
					)}
				</div>
			)}
			<style>{`
				.code-file-preview .code-line {
					display: block;
					counter-increment: line;
					padding-left: 0.5rem;
				}
				.code-file-preview .code-line::before {
					content: counter(line);
					display: inline-block;
					width: 2.5em;
					margin-right: 1em;
					text-align: right;
					color: #6b7280;
					user-select: none;
					flex-shrink: 0;
				}
				.dark .code-file-preview .code-line::before {
					color: #9ca3af;
				}
				.code-file-preview pre {
					margin: 0 !important;
					border-radius: 0 !important;
				}
			`}</style>
		</Modal>
	);
};

export default FilePreviewModal;
