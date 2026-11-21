import type { Stats } from "node:fs";
import { copyFile, lstat, mkdir, realpath, rename, rm, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { BrowserSnapshot } from "../web/lib/browser-snapshot.ts";

const ASSETS = "assets";
const ASSET_MANIFEST = ".backlog-export-assets.json";

type MarkdownNode = ReturnType<typeof fromMarkdown> | ReturnType<typeof fromMarkdown>["children"][number];

function markdownLinks(markdown: string): string[] {
	const urls: string[] = [];
	const definitions = new Map<string, string>();
	const references = new Set<string>();
	const visit = (node: MarkdownNode): void => {
		switch (node.type) {
			case "link":
			case "image":
				urls.push(node.url);
				break;
			case "definition":
				if (!definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
				break;
			case "linkReference":
			case "imageReference":
				references.add(node.identifier);
				break;
		}
		if ("children" in node) node.children.forEach(visit);
	};
	visit(fromMarkdown(markdown));
	for (const reference of references) {
		const url = definitions.get(reference);
		if (url !== undefined) urls.push(url);
	}
	return urls;
}

function isAssetName(name: string): boolean {
	if (name.includes("\\") || name.includes(":") || name.includes("\0")) return false;
	return name.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function assetName(href: string): string | undefined {
	const path = href.replace(/^\.?\//, "").split(/[?#]/, 1)[0] ?? "";
	if (!path.startsWith(`${ASSETS}/`)) return undefined;
	try {
		const name = decodeURIComponent(path.slice(ASSETS.length + 1));
		return isAssetName(name) ? name : undefined;
	} catch {
		return undefined;
	}
}

function publishedAssetNames(snapshot: BrowserSnapshot): string[] {
	const records = [...snapshot.tasks, ...snapshot.docs, ...snapshot.decisions, ...snapshot.milestones];
	const urls = records.flatMap((record) => markdownLinks(record.rawContent ?? ""));
	return [...new Set(urls.map(assetName).filter((name) => name !== undefined))].sort();
}

function isWithin(root: string, target: string): boolean {
	const fromRoot = relative(root, target);
	return fromRoot !== "" && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
}

async function sourceAsset(root: string, name: string): Promise<string | undefined> {
	const source = await realpath(join(root, name)).catch(() => undefined);
	if (!source || !isWithin(root, source)) return undefined;
	return (await stat(source)).isFile() ? source : undefined;
}

async function existingFile(path: string): Promise<Stats | undefined> {
	try {
		return await lstat(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

async function outputAsset(output: string, name: string): Promise<string> {
	let path = output;
	for (const part of [ASSETS, ...name.split("/")]) {
		path = join(path, part);
		if ((await existingFile(path))?.isSymbolicLink()) {
			throw new Error(`Cannot export through a symbolic link: ${path}`);
		}
	}
	return path;
}

async function existingAssetPath(path: string): Promise<string | undefined> {
	if (!(await existingFile(path))) return undefined;
	return await realpath(path);
}

async function readAssetManifest(path: string): Promise<Set<string>> {
	const entry = await existingFile(path);
	if (!entry) return new Set();
	if (!entry.isFile()) throw new Error(`Cannot use the export asset list at ${path}`);
	const files: unknown = await Bun.file(path).json();
	if (!Array.isArray(files) || !files.every((name) => typeof name === "string" && isAssetName(name))) {
		throw new Error(`Invalid export asset list at ${path}`);
	}
	return new Set(files);
}

async function writeAssetManifest(path: string, names: Iterable<string>): Promise<void> {
	const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
	try {
		await Bun.write(temporaryPath, JSON.stringify([...names]));
		await rename(temporaryPath, path);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

async function sourceAttachments(backlogDir: string, snapshot: BrowserSnapshot): Promise<Map<string, string>> {
	const assets = join(await realpath(backlogDir), ASSETS);
	const sources = new Map<string, string>();
	if (!(await existingFile(assets))?.isDirectory()) return sources;
	for (const name of publishedAssetNames(snapshot)) {
		const source = await sourceAsset(assets, name);
		if (source) sources.set(name, source);
	}
	return sources;
}

/** Copy project attachments and return cleanup to run after the new page is in place. */
export async function copyBrowserAttachments(
	backlogDir: string,
	outputDir: string,
	snapshot: BrowserSnapshot,
): Promise<() => Promise<void>> {
	const manifest = join(outputDir, ASSET_MANIFEST);
	const previous = await readAssetManifest(manifest);
	const previousPaths = await Promise.all(
		[...previous].map(async (name) => existingAssetPath(await outputAsset(outputDir, name))),
	);
	const ownedPaths = new Set(previousPaths.filter((path) => path !== undefined));
	const next = await sourceAttachments(backlogDir, snapshot);
	const copies: Array<{ source: string; target: string }> = [];
	for (const [name, source] of next) {
		const target = await outputAsset(outputDir, name);
		const existing = await existingAssetPath(target);
		if (existing !== undefined && !ownedPaths.has(existing)) {
			throw new Error(`Cannot overwrite an existing site asset: ${target}`);
		}
		copies.push({ source, target });
	}

	const owned = [...new Set([...previous, ...next.keys()])];
	// Keep track of additions before writing so an interrupted export can be safely retried.
	if (owned.length > 0) await writeAssetManifest(manifest, owned);
	for (const { source, target } of copies) {
		await mkdir(dirname(target), { recursive: true });
		await copyFile(source, target);
	}
	// Differently cased references may name the same file on the output filesystem.
	const retainedPaths = new Set(await Promise.all(copies.map(({ target }) => realpath(target))));
	const stalePaths = [...ownedPaths].filter((path) => !retainedPaths.has(path));

	return async () => {
		for (const path of stalePaths) {
			if (await existingFile(path)) await unlink(path);
		}
		if (next.size > 0) await writeAssetManifest(manifest, next.keys());
		else if (previous.size > 0) await unlink(manifest);
	};
}
