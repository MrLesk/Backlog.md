import mammoth from "mammoth";
import type { AssetManager } from "./assets.ts";

export interface DocxConvertResult {
	html: string;
	images: { tempUrl: string; alt: string }[];
	messages: string[];
}

export async function convertDocxToMarkdown(buffer: Buffer, assetManager: AssetManager): Promise<DocxConvertResult> {
	const images: { tempUrl: string; alt: string }[] = [];

	const result = await mammoth.convertToHtml(
		{ buffer },
		{
			convertImage: mammoth.images.imgElement(async (image) => {
				const imageBuffer = await image.readAsArrayBuffer();
				const blob = new Blob([new Uint8Array(imageBuffer)], { type: image.contentType });
				const file = new File([blob], "image.png", { type: image.contentType });
				const uploadResult = await assetManager.uploadFile(file, true);
				images.push({ tempUrl: uploadResult.url, alt: "" });
				return { src: uploadResult.url };
			}),
		},
	);

	return {
		html: result.value,
		images,
		messages: result.messages.map((m) => m.message),
	};
}
