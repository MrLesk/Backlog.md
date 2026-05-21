import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../lib/api";
import MermaidMarkdown from "./MermaidMarkdown";
import ErrorBoundary from "../components/ErrorBoundary";
import Modal from "./Modal";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";
import { SuccessToast } from "./SuccessToast";
import { useTheme } from "../contexts/ThemeContext";
import ChipInput from "./ChipInput";
import type { WikiPage } from "../../types";

function WikiLinkPreview({ path, onClose }: { path: string; onClose: () => void }) {
	const [previewPage, setPreviewPage] = useState<WikiPage | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<Error | null>(null);
	const { theme } = useTheme();

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				setPreviewLoading(true);
				setPreviewError(null);
				const data = await apiClient.fetchWikiPage(path);
				if (!cancelled) setPreviewPage(data);
			} catch (err) {
				if (!cancelled) {
					setPreviewError(err instanceof Error ? err : new Error("Failed to load wiki page"));
				}
			} finally {
				if (!cancelled) setPreviewLoading(false);
			}
		};
		load();
		return () => { cancelled = true; };
	}, [path]);

	const previewTitle =
		typeof previewPage?.frontmatter?.title === "string" && previewPage.frontmatter.title
			? previewPage.frontmatter.title
			: path.split("/").pop()?.replace(/\.md$/i, "") || path;

	const previewContent = previewPage?.content.replace(/\[\[([^\]]+)\]\]/g, (_match, p1) => {
		const linkText = p1;
		const linkPath = encodeURIComponent(p1);
		return `[${linkText}](/wiki/${linkPath})`;
	}) || "";

	return (
		<Modal isOpen={true} onClose={onClose} title={previewTitle} maxWidthClass="max-w-3xl">
			{previewLoading ? (
				<div className="text-gray-500 dark:text-gray-400 py-8 text-center">Loading...</div>
			) : previewError || !previewPage ? (
				<div className="text-center py-8">
					<svg className="mx-auto h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{previewError?.message || "Page not found"}</p>
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h5l2 2h11v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
						</svg>
						<span>{previewPage.path}</span>
					</div>
					<div
						className="prose prose-sm !max-w-none w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
						data-color-mode={theme}
					>
						<MermaidMarkdown source={previewContent} />
					</div>
				</div>
			)}
		</Modal>
	);
}

export default function WikiDetail() {
	const { "*": wikiPath } = useParams();
	const [page, setPage] = useState<WikiPage | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [previewPath, setPreviewPath] = useState<string | null>(null);
	const { theme } = useTheme();
	const contentRef = useRef<HTMLDivElement>(null);

	// Editing state
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState("");
	const [originalContent, setOriginalContent] = useState("");
	const [editTitle, setEditTitle] = useState("");
	const [originalTitle, setOriginalTitle] = useState("");
	const [editLabels, setEditLabels] = useState<string[]>([]);
	const [originalLabels, setOriginalLabels] = useState<string[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [showSaveSuccess, setShowSaveSuccess] = useState(false);

	const hasChanges = editContent !== originalContent || editTitle !== originalTitle || JSON.stringify(editLabels) !== JSON.stringify(originalLabels);

	const loadWikiPage = useCallback(async () => {
		if (!wikiPath) return;
		try {
			setIsLoading(true);
			setError(null);
			const data = await apiClient.fetchWikiPage(wikiPath);
			setPage(data);
		} catch (err) {
			const e = err instanceof Error ? err : new Error("Failed to load wiki page");
			setError(e);
			console.error("Failed to load wiki page:", e);
		} finally {
			setIsLoading(false);
		}
	}, [wikiPath]);

	useEffect(() => {
		if (wikiPath) {
			loadWikiPage();
		}
	}, [wikiPath, loadWikiPage]);

	useEffect(() => {
		if (!contentRef.current) return;
		const container = contentRef.current;

		const handleClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const anchor = target.closest("a") as HTMLAnchorElement | null;
			if (!anchor) return;
			const href = anchor.getAttribute("href");
			if (!href || !href.startsWith("/wiki/")) return;
			e.preventDefault();
			const path = decodeURIComponent(href.slice("/wiki/".length));
			setPreviewPath(path);
		};

		container.addEventListener("click", handleClick);
		return () => container.removeEventListener("click", handleClick);
	}, [page?.content]);

	const handleEdit = () => {
		const currentTitle =
			typeof page?.frontmatter?.title === "string" && page.frontmatter.title
				? page.frontmatter.title
				: page?.path.split("/").pop()?.replace(/\.md$/i, "") || "";
		const currentLabels = Array.isArray(page?.frontmatter?.labels)
			? page.frontmatter.labels.map(String)
			: [];
		setEditContent(page?.content || "");
		setOriginalContent(page?.content || "");
		setEditTitle(currentTitle);
		setOriginalTitle(currentTitle);
		setEditLabels(currentLabels);
		setOriginalLabels(currentLabels);
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
	};

	const handleSave = useCallback(async () => {
		if (!wikiPath || !hasChanges) return;
		try {
			setIsSaving(true);
			await apiClient.updateWikiPage(wikiPath, editContent, editTitle, editLabels);
			setIsEditing(false);
			setShowSaveSuccess(true);
			setTimeout(() => setShowSaveSuccess(false), 4000);
			await loadWikiPage();
		} catch (err) {
			console.error("Failed to save wiki page:", err);
		} finally {
			setIsSaving(false);
		}
	}, [wikiPath, editContent, editTitle, editLabels, hasChanges, loadWikiPage]);

	if (!wikiPath) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center">
					<svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
					</svg>
					<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No wiki page selected</h3>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select a wiki page from the sidebar to view its content.</p>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-gray-500 dark:text-gray-400">Loading...</div>
			</div>
		);
	}

	if (error || !page) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center">
					<svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Failed to load wiki page</h3>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error?.message || "Page not found"}</p>
				</div>
			</div>
		);
	}

	const title =
		typeof page.frontmatter?.title === "string" && page.frontmatter.title
			? page.frontmatter.title
			: page.path.split("/").pop()?.replace(/\.md$/i, "") || page.path;

	const sanitizedContent = page.content.replace(/\[\[([^\]]+)\]\]/g, (_match, p1) => {
		const linkText = p1;
		const linkPath = encodeURIComponent(p1);
		return `[${linkText}](/wiki/${linkPath})`;
	});

	return (
		<ErrorBoundary>
			<div className="h-full bg-white dark:bg-gray-900 flex flex-col transition-colors duration-200">
				{/* Header Section */}
				<div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
					<div className="max-w-4xl mx-auto px-8 py-6">
						<div className="flex items-start justify-between mb-2">
							<div className="flex-1">
								{isEditing ? (
									<div className="space-y-3 mb-2">
										<input
											type="text"
											value={editTitle}
											onChange={(e) => setEditTitle(e.target.value)}
											className="text-3xl font-bold text-gray-900 dark:text-gray-100 w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
											placeholder="Page title"
										/>
										<ChipInput
											name="wiki-labels"
											label="Labels"
											value={editLabels}
											onChange={setEditLabels}
											placeholder="Type label and press Enter or comma"
										/>
										<div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h5l2 2h11v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
											</svg>
											<span>{page.path}</span>
										</div>
									</div>
								) : (
									<>
										<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-200">
											{title}
										</h1>
										{(() => {
											const labels = Array.isArray(page.frontmatter?.labels) ? page.frontmatter.labels.map(String) : [];
											return labels.length > 0 ? (
												<div className="flex flex-wrap gap-1.5 mb-3">
													{labels.map((label) => (
														<span
															key={label}
															className="inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded transition-colors duration-200"
														>
															{label}
														</span>
													))}
												</div>
											) : null;
										})()}
										<div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
											<div className="flex items-center space-x-2">
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
												</svg>
												<span>Wiki</span>
											</div>
											<div className="flex items-center space-x-2">
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h5l2 2h11v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
												</svg>
												<span>{page.path}</span>
											</div>
										</div>
									</>
								)}
							</div>
							<div className="flex items-center space-x-2 ml-4">
								{isEditing ? (
									<>
										<button
											onClick={handleCancelEdit}
											className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
										>
											Cancel
										</button>
										<button
											onClick={handleSave}
											disabled={!hasChanges || isSaving}
											className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 ${
											hasChanges && !isSaving
												? 'bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-blue-400'
												: 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
										}`}
										>
											<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
											</svg>
											{isSaving ? 'Saving...' : 'Save'}
										</button>
									</>
								) : (
									<button
										onClick={handleEdit}
										className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
									>
										Edit
									</button>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Content Section */}
				<div className="flex-1 bg-gray-50 dark:bg-gray-800 transition-colors duration-200 flex flex-col">
					<div className="flex-1 p-8 flex flex-col min-h-0">
						{isEditing ? (
							<div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
								<PasteAwareMDEditor
									value={editContent}
									onChange={(val) => setEditContent(val || "")}
									preview="edit"
									height="100%"
									hideToolbar={false}
									data-color-mode={theme}
									textareaProps={{
										placeholder: "Write your wiki content here...",
										style: { fontSize: "14px", resize: "none" },
									}}
								/>
							</div>
						) : (
							<div
								ref={contentRef}
								className="prose prose-sm !max-w-none w-full p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
								data-color-mode={theme}
							>
								<MermaidMarkdown source={sanitizedContent} />
							</div>
						)}
					</div>
				</div>
			</div>

			{previewPath && (
				<WikiLinkPreview path={previewPath} onClose={() => setPreviewPath(null)} />
			)}

			{showSaveSuccess && (
				<SuccessToast
					message="Wiki page saved successfully!"
					onDismiss={() => setShowSaveSuccess(false)}
				/>
			)}
		</ErrorBoundary>
	);
}
