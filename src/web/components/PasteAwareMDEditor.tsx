import React, { useCallback, useRef, useState } from "react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { apiClient } from "../lib/api";
import { cleanHtml, handlePasteAsMarkdown } from "../utils/paste-as-markdown";

type MDEditorProps = React.ComponentProps<typeof MDEditor>;

async function uploadImage(source: Blob | string): Promise<string | null> {
	try {
		if (typeof source === "string") {
			if (source.startsWith("data:")) {
				const result = await apiClient.uploadTempAssetFromDataUri(source);
				return result.url;
			}
			const result = await apiClient.uploadTempAssetFromUrl(source);
			return result.url;
		}
		const file = new File([source], "image.png", { type: source.type || "image/png" });
		const result = await apiClient.uploadTempAsset(file);
		return result.url;
	} catch (err) {
		console.error("Image upload failed:", err);
		return null;
	}
}

function getImageFileFromClipboard(data: DataTransfer): File | null {
	// Some browsers/OS put the screenshot in clipboardData.files.
	for (const file of data.files) {
		if (file.type.startsWith("image/")) {
			return file;
		}
	}
	// Others expose it through DataTransferItemList.
	for (const item of data.items) {
		if (item.kind === "file" && item.type.startsWith("image/")) {
			const file = item.getAsFile();
			if (file) return file;
		}
	}
	return null;
}

function insertMarkdownAtCaret(
	textarea: HTMLTextAreaElement,
	markdown: string,
	onChange: (value: string) => void,
): void {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const currentValue = textarea.value;
	const newValue = currentValue.slice(0, start) + markdown + currentValue.slice(end);
	onChange(newValue);
	requestAnimationFrame(() => {
		textarea.selectionStart = textarea.selectionEnd = start + markdown.length;
		textarea.focus();
	});
}

export const PasteAwareMDEditor: React.FC<MDEditorProps> = ({
	value,
	onChange,
	textareaProps,
	extraCommands: propExtraCommands,
	...rest
}) => {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [isConverting, setIsConverting] = useState(false);

	const handleDocxUpload = useCallback(
		async (file: File) => {
			if (!onChange) return;
			setIsConverting(true);
			try {
				const result = await apiClient.convertDocx(file);
				const cleanedHtml = await cleanHtml(result.html, { keepMedia: true });

				const turndownService = new TurndownService({
					headingStyle: "atx",
					bulletListMarker: "-",
					codeBlockStyle: "fenced",
					strongDelimiter: "**",
					emDelimiter: "*",
					fence: "```",
				});
				turndownService.use(gfm);
				turndownService.remove(["style", "meta", "link", "script"]);
				turndownService.addRule("keepBr", {
					filter: "br",
					replacement: () => "<br>",
				});

				let markdown = turndownService.turndown(cleanedHtml);

				// Post-processing: move whitespace inside bold/italic markers to the outside.
				let prev: string;
				do {
					prev = markdown;
					markdown = markdown.replace(/\*\*(\s*)([^\n]*?)(\s*)\*\*/g, "$1**$2**$3");
				} while (markdown !== prev);

				do {
					prev = markdown;
					markdown = markdown.replace(/(?<!\*)\*(\s*)([^\s*][^\n]*?[^\s*])(\s*)\*(?!\*)/g, "$1*$2*$3");
				} while (markdown !== prev);

				// Ensure a space after bold/italic closers when they touch plain text.
				markdown = markdown.replace(/\*\*([^\s][^\n]*?)\*\*([^\s*<|\n\r])/g, "**$1** $2");
				markdown = markdown.replace(/(?<!\*)\*([^\s*][^\n]*?)\*([^\s*<|\n\r])(?!\*)/g, "*$1* $2");

				// Ensure ordered-list markers are followed by a space.
				markdown = markdown.replace(/(^|\s)(\d+\.)([^\s\d])/g, "$1$2 $3");

				const textarea =
					textareaRef.current ??
					document.querySelector<HTMLTextAreaElement>(".w-md-editor-text-input");
				if (textarea) {
					insertMarkdownAtCaret(textarea, markdown, onChange);
				}
				if (result.messages.length > 0) {
					console.warn("DOCX conversion messages:", result.messages);
				}
			} catch (err) {
				console.error("Word upload failed:", err);
				alert(err instanceof Error ? err.message : "Failed to convert Word document");
			} finally {
				setIsConverting(false);
			}
		},
		[onChange],
	);

	const handlePaste = useCallback(
		async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
			if (!onChange) {
				textareaProps?.onPaste?.(e);
				return;
			}

			const html = e.clipboardData.getData("text/html");
			const imageFile = getImageFileFromClipboard(e.clipboardData);
			const textarea = e.currentTarget;

			// Pure image paste (screenshot tools) — no HTML, just an image blob.
			if (imageFile && !html) {
				e.preventDefault();
				const url = await uploadImage(imageFile);
				if (url) {
					insertMarkdownAtCaret(textarea, `![image](${url})`, onChange);
				}
				return;
			}

			// Rich-text paste (Word, web pages, Excel) — may contain <img> tags.
			const markdown = await handlePasteAsMarkdown(e, uploadImage);
			if (markdown !== null) {
				e.preventDefault();
				let combined = markdown;
				// Excel places both HTML (table) and an image blob on the clipboard.
				if (imageFile) {
					const url = await uploadImage(imageFile);
					if (url) {
						combined += `\n\n![image](${url})`;
					}
				}
				insertMarkdownAtCaret(textarea, combined, onChange);
				return;
			}

			// Screenshot tools sometimes place both a bare <img> (invalid src) and the
			// actual image blob on the clipboard. If the HTML path couldn't handle the
			// paste but a binary image is present, fall back to direct image upload.
			if (imageFile) {
				e.preventDefault();
				const url = await uploadImage(imageFile);
				if (url) {
					insertMarkdownAtCaret(textarea, `![image](${url})`, onChange);
				}
				return;
			}

			if (textareaProps?.onPaste) {
				textareaProps.onPaste(e);
			}
		},
		[onChange, textareaProps],
	);

	const wordCommand: commands.ICommand = {
		name: "upload-word",
		keyCommand: "upload-word",
		render: () => {
			return (
				<button
					type="button"
					disabled={isConverting}
					title="Upload Word document (.docx)"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => fileInputRef.current?.click()}
				>
					{isConverting ? (
						<span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
					) : (
						<svg className="h-3.5 w-3.5" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
							<path
								d="M106.915276 0.008063C87.725354 0.008063 68.535433 19.189921 68.535433 38.379843V985.088c0 19.189921 19.189921 38.379843 38.379843 38.379843h805.976693c19.189921 0 38.379843-19.189921 38.379842-38.379843V223.893165L727.394772 0.008063H106.915276z"
								fill="#2C97FF"
							/>
							<path
								d="M727.394772 0.008063v184.223244c0 19.189921 19.189921 39.661858 39.661858 39.661858H951.271811L727.394772 0.008063z"
								fill="#99D3FF"
							/>
							<path
								d="M738.900661 329.881197c-21.600756 0-39.847307 18.246551-39.847307 39.847307v256.056441L538.583685 457.977953c-7.071244-8.482268-16.988724-12.965291-28.680063-12.965292-11.038236 0-22.011969 4.966803-28.494614 12.739528L318.197921 627.123402V369.728504c0-21.608819-18.254614-39.847307-39.85537-39.847307s-39.85537 18.246551-39.85537 39.847307v356.940598c0 16.311433 10.56252 31.550488 25.688693 37.049449a41.064819 41.064819 0 0 0 14.053795 2.467276c10.965669 0 21.802331-4.33789 29.889512-12.425071l201.792504-210.62148L711.502614 752.277165c7.071244 8.466142 16.988724 12.965291 28.680063 12.965292 5.418331 0 10.167433-0.120945 12.900788-1.531969 15.110047-5.490898 25.664504-20.729953 25.664504-37.041386v-356.948661c0-21.592693-18.246551-39.839244-39.847308-39.839244"
								fill="#FFFFFF"
							/>
							</svg>
						)}
					</button>
				);
		},
	};

	return (
		<div
			className="relative"
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => {
				e.preventDefault();
				const file = e.dataTransfer.files[0];
				if (file && file.name.toLowerCase().endsWith(".docx")) {
					void handleDocxUpload(file);
				}
			}}
		>
			{onChange && (
				<input
					ref={fileInputRef}
					type="file"
					accept=".docx"
					className="sr-only"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) void handleDocxUpload(file);
						e.target.value = "";
					}}
				/>
			)}
			<MDEditor
				{...rest}
				value={value}
				onChange={onChange}
				extraCommands={[wordCommand, ...(propExtraCommands ?? commands.getExtraCommands())]}
				textareaProps={{
					...textareaProps,
					// biome-ignore lint/suspicious/noExplicitAny: library types don't expose ref on textareaProps
					ref: (el: HTMLTextAreaElement | null) => {
						textareaRef.current = el;
						const originalRef = (textareaProps as any)?.ref;
						if (typeof originalRef === "function") {
							originalRef(el);
						} else if (originalRef && typeof originalRef === "object" && "current" in originalRef) {
							(originalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
						}
					},
					onPaste: handlePaste,
					// biome-ignore lint/suspicious/noExplicitAny: library types don't expose ref on textareaProps
				} as any}
			/>
		</div>
	);
};
