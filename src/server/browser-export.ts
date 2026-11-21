import { mkdir, rename, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
import lockfile from "proper-lockfile";
import type { Core } from "../core/backlog.ts";
import { collectArchivedMilestoneKeys, milestoneKey } from "../core/milestones.ts";
import type { BacklogConfig } from "../types/index.ts";
import { createMilestoneFilterValueResolver } from "../utils/milestone-filter.ts";
import { canonicalTaskId } from "../utils/task-id.ts";
import browserBundle from "../web/index.html";
import { BROWSER_SNAPSHOT_ID, type BrowserSnapshot } from "../web/lib/browser-snapshot.ts";
import { copyBrowserAttachments } from "./browser-export-assets.ts";

function publishedConfig(config: BacklogConfig): BacklogConfig {
	return {
		projectName: config.projectName,
		statuses: config.statuses,
		labels: config.labels,
		types: config.types,
		priorities: config.priorities,
		projects: config.projects,
		dateFormat: config.dateFormat,
		defaultStatus: config.defaultStatus,
		definitionOfDone: config.definitionOfDone,
		hideEmptyColumns: config.hideEmptyColumns,
		maxColumnWidth: config.maxColumnWidth,
		zeroPaddedIds: config.zeroPaddedIds,
		prefixes: config.prefixes,
	};
}

async function loadBrowserSnapshot(core: Core, version: string, tasksOnly: boolean): Promise<BrowserSnapshot> {
	const fs = core.filesystem;
	const config = await fs.loadConfig();
	if (!config) throw new Error("No Backlog.md project found. Run `backlog init` to initialize.");

	const [records, archivedTasks, docs, decisions, milestones, archivedMilestones] = await Promise.all([
		core.queryTasks({ includeCrossBranch: false }),
		fs.listArchivedTasks(),
		tasksOnly ? [] : fs.listDocuments(),
		tasksOnly ? [] : fs.listDecisions(),
		fs.listMilestones(),
		fs.listArchivedMilestones(),
	]);
	const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestones, milestones));
	const resolveMilestone = createMilestoneFilterValueResolver([...milestones, ...archivedMilestones]);
	const tasks = records
		.filter((task) => task.status.trim().toLowerCase() !== "draft")
		.map(({ filePath: _filePath, revision: _revision, onStatusChange: _onStatusChange, ...task }) => {
			const milestone = task.milestone ?? "";
			const resolvedMilestone = resolveMilestone.resolveId(milestone) ?? milestone;
			return archivedKeys.has(milestoneKey(resolvedMilestone)) ? { ...task, milestone: undefined } : task;
		});
	// Keep statuses for referenced archives so final-status tasks still satisfy dependencies.
	const dependencyIds = new Set(tasks.flatMap((task) => task.dependencies.map((id) => canonicalTaskId(id))));
	const archivedDependencyStatuses = archivedTasks
		.filter(({ id }) => dependencyIds.has(canonicalTaskId(id)))
		.map(({ id, status }) => ({ id, status }));

	return {
		version,
		config: publishedConfig(config),
		tasks,
		archivedDependencyStatuses,
		docs,
		decisions,
		milestones: tasksOnly ? [] : milestones,
		tasksOnly,
	};
}

type BrowserAsset = { name: string; contents: Blob };

async function loadBrowserAssets(): Promise<{ html: string; assets: BrowserAsset[] }> {
	if (browserBundle.files) {
		return {
			html: await Bun.file(resolve(import.meta.dir, browserBundle.index)).text(),
			assets: browserBundle.files
				.filter(({ path }) => path !== browserBundle.index)
				.map(({ path }) => ({ name: basename(path), contents: Bun.file(resolve(import.meta.dir, path)) })),
		};
	}

	// Source runs have no embedded bundle. Resolve the build-only plugin at runtime in that case.
	const pluginName = "bun-plugin-tailwind";
	const { default: tailwind }: typeof import("bun-plugin-tailwind") = await import(pluginName);
	const result = await Bun.build({
		entrypoints: [browserBundle.index],
		publicPath: "./",
		minify: true,
		plugins: [tailwind],
		define: { "process.env.NODE_ENV": JSON.stringify("production") },
	});
	const entry = result.outputs.find((file) => file.path === "./index.html");
	if (!entry) throw new Error("The browser bundle has no index.html.");
	return {
		html: await entry.text(),
		assets: result.outputs
			.filter((file) => file !== entry)
			.map((file) => ({ name: basename(file.path), contents: file })),
	};
}

function renderExportPage(html: string, snapshot: BrowserSnapshot, assets: BrowserAsset[]): string {
	const json = JSON.stringify(snapshot).replaceAll("<", "\\u003c");
	const assetNames = new Set(assets.map(({ name }) => name));
	return new HTMLRewriter()
		.on('base[href="/"], script[data-backlog-shell-refresh]', {
			element: (element) => {
				element.remove();
			},
		})
		.on("link[href], script[src]", {
			element: (element) => {
				const attribute = element.tagName === "link" ? "href" : "src";
				const name = basename(element.getAttribute(attribute) ?? "");
				if (assetNames.has(name)) element.setAttribute(attribute, `./${name}`);
			},
		})
		.on("head", {
			element: (element) => {
				element.append(
					`<meta name="robots" content="noindex"><script type="application/json" id="${BROWSER_SNAPSHOT_ID}">${json}</script>`,
					{ html: true },
				);
			},
		})
		.transform(html);
}

export async function exportBrowserSite(
	core: Core,
	directory: string,
	version: string,
	tasksOnly: boolean,
): Promise<void> {
	const snapshot = await loadBrowserSnapshot(core, version, tasksOnly);
	const { html, assets } = await loadBrowserAssets();
	await mkdir(directory, { recursive: true });
	const release = await lockfile.lock(directory, { lockfilePath: resolve(directory, ".backlog-export.lock") });
	try {
		await writeBrowserSite(core.filesystem.backlogDir, directory, snapshot, html, assets);
	} finally {
		await release();
	}
}

async function writeBrowserSite(
	backlogDirectory: string,
	directory: string,
	snapshot: BrowserSnapshot,
	html: string,
	assets: BrowserAsset[],
): Promise<void> {
	const indexPath = resolve(directory, "index.html");
	const indexFile = Bun.file(indexPath);
	const snapshotMarker = `id="${BROWSER_SNAPSHOT_ID}"`;
	if ((await indexFile.exists()) && !(await indexFile.text()).includes(snapshotMarker)) {
		throw new Error(`The destination already contains an index.html outside a Backlog.md export: ${indexPath}`);
	}

	const pruneAttachments = await copyBrowserAttachments(backlogDirectory, directory, snapshot);
	await Promise.all(assets.map(({ name, contents }) => Bun.write(resolve(directory, name), contents)));

	// Swap in the new page only after its assets are available.
	const temporaryIndex = resolve(directory, `.backlog-index-${crypto.randomUUID()}.tmp`);
	try {
		await Bun.write(temporaryIndex, renderExportPage(html, snapshot, assets));
		await rename(temporaryIndex, indexPath);
		await pruneAttachments();
	} finally {
		await rm(temporaryIndex, { force: true });
	}
}
