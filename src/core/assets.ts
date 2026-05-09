import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

export interface UploadResult {
	url: string;
}

export class ClientError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ClientError";
	}
}

export class AssetManager {
	constructor(private assetsRoot: string) {}

	private get tempDir(): string {
		return join(this.assetsRoot, ".temp");
	}

	private get pasteDir(): string {
		return join(this.assetsRoot, "paste");
	}

	private resolveExtFromMime(mime: string): string {
		const map: Record<string, string> = {
			"image/png": "png",
			"image/jpeg": "jpg",
			"image/gif": "gif",
			"image/webp": "webp",
			"image/svg+xml": "svg",
		};
		return map[mime] || "png";
	}

	async uploadFile(file: File, isTemp = false): Promise<UploadResult> {
		const buffer = new Uint8Array(await file.arrayBuffer());
		const nameMatch = file.name.match(/\.([^./]+)$/);
		const ext = nameMatch ? nameMatch[1]!.toLowerCase() : this.resolveExtFromMime(file.type);
		return this.saveBuffer(buffer, ext, isTemp);
	}

	async uploadFromDataUri(dataUri: string, isTemp = false): Promise<UploadResult> {
		const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
		if (!match) {
			throw new ClientError("Invalid data URI");
		}
		const mime = match[1]!;
		const base64 = match[2]!;
		const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
		return this.saveBuffer(buffer, this.resolveExtFromMime(mime), isTemp);
	}

	async uploadFromUrl(imageUrl: string, isTemp = false): Promise<UploadResult> {
		const blob = await this.downloadImage(imageUrl);
		if (!blob) {
			throw new ClientError("Failed to download image");
		}
		const buffer = new Uint8Array(await blob.arrayBuffer());
		return this.saveBuffer(buffer, this.resolveExtFromMime(blob.type), isTemp);
	}

	async promote(urls: string[]): Promise<Record<string, string>> {
		const pasteDir = this.pasteDir;
		await mkdir(pasteDir, { recursive: true });
		const result: Record<string, string> = {};

		for (const url of urls) {
			if (typeof url !== "string" || !url.startsWith("/assets/.temp/")) continue;
			const filename = url.slice("/assets/.temp/".length);
			if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) continue;

			const sourcePath = join(this.assetsRoot, ".temp", filename);
			const destPath = join(pasteDir, filename);

			const sourceFile = Bun.file(sourcePath);
			if (!(await sourceFile.exists())) continue;

			await Bun.write(destPath, sourceFile);
			await rm(sourcePath);
			result[url] = `/assets/paste/${filename}`;
		}
		return result;
	}

	async cleanup(options?: { maxAgeMs?: number }): Promise<{ removed: number }> {
		const maxAgeMs = options?.maxAgeMs ?? 30 * 60 * 1000;
		const entries = await readdir(this.tempDir).catch(() => [] as string[]);
		if (entries.length === 0) return { removed: 0 };

		const now = Date.now();
		let removed = 0;

		for (const name of entries) {
			const filePath = join(this.tempDir, name);
			try {
				const info = await stat(filePath);
				if (!info.isFile()) continue;
				if (now - info.mtimeMs > maxAgeMs) {
					await rm(filePath);
					removed++;
				}
			} catch {
				// ignore per-file errors
			}
		}
		return { removed };
	}

	async downloadImage(url: string): Promise<Blob | null> {
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

			const hostname = parsed.hostname.toLowerCase();
			if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return null;
			if (/^10\./.test(hostname)) return null;
			if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return null;
			if (/^192\.168\./.test(hostname)) return null;

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30000);

			let currentUrl = url;
			let redirects = 0;
			const maxRedirects = 3;

			while (redirects <= maxRedirects) {
				const response = await fetch(currentUrl, {
					signal: controller.signal,
					redirect: "manual",
				});

				if (response.status >= 300 && response.status < 400) {
					const location = response.headers.get("location");
					if (!location) break;
					currentUrl = new URL(location, currentUrl).href;
					redirects++;
					const redirectParsed = new URL(currentUrl);
					if (redirectParsed.protocol !== "http:" && redirectParsed.protocol !== "https:") break;
					const redirectHost = redirectParsed.hostname.toLowerCase();
					if (redirectHost === "localhost" || redirectHost === "127.0.0.1" || redirectHost === "::1") break;
					if (/^10\./.test(redirectHost)) break;
					if (/^172\.(1[6-9]|2\d|3[01])\./.test(redirectHost)) break;
					if (/^192\.168\./.test(redirectHost)) break;
					continue;
				}

				clearTimeout(timeout);

				if (!response.ok) return null;

				const contentType = response.headers.get("content-type") || "";
				if (!contentType.startsWith("image/")) return null;

				const contentLength = response.headers.get("content-length");
				if (contentLength) {
					const size = Number.parseInt(contentLength, 10);
					if (!Number.isNaN(size) && size > 20 * 1024 * 1024) return null;
				}

				const blob = await response.blob();
				if (blob.size > 20 * 1024 * 1024) return null;
				return blob;
			}

			clearTimeout(timeout);
			return null;
		} catch {
			return null;
		}
	}

	private async saveBuffer(buffer: Uint8Array, ext: string, isTemp: boolean): Promise<UploadResult> {
		if (buffer.length === 0) {
			throw new ClientError("Empty file");
		}
		if (buffer.length > 20 * 1024 * 1024) {
			throw new ClientError("File too large (max 20 MB)");
		}

		const targetDir = isTemp ? this.tempDir : this.pasteDir;
		await mkdir(targetDir, { recursive: true });

		const filename = `${randomUUID()}.${ext}`;
		const filePath = join(targetDir, filename);
		await Bun.write(filePath, buffer);

		const relPath = isTemp ? `.temp/${filename}` : `paste/${filename}`;
		return { url: `/assets/${relPath}` };
	}
}
