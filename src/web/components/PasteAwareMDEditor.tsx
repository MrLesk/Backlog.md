import React, { useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
import { apiClient } from "../lib/api";
import { handlePasteAsMarkdown } from "../utils/paste-as-markdown";

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
	...rest
}) => {
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

	return (
		<MDEditor
			{...rest}
			value={value}
			onChange={onChange}
			textareaProps={{
				...textareaProps,
				onPaste: handlePaste,
			}}
		/>
	);
};
