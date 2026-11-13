import { relative, resolve } from "node:path";
import type { ScreenInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import type { Task } from "../../types/index.ts";
import { copyToClipboard } from "../../utils/clipboard.ts";
import { createPopupChrome } from "./filter-popup.ts";

type YankTarget = "id" | "relative" | "absolute" | "github";

const YANK_TARGETS: Array<{ key: string; target: YankTarget; label: string }> = [
	{ key: "Y", target: "id", label: "Task ID" },
	{ key: "R", target: "relative", label: "Repository-relative path" },
	{ key: "A", target: "absolute", label: "Absolute path" },
];

export async function openTaskYankPopup(options: {
	screen: ScreenInterface;
	task: Task;
	projectRoot: string;
	repositoryRoot: string | null;
	githubUrl?: string | null;
	onFeedback: (message: string, success: boolean) => void;
	copy?: (text: string) => Promise<boolean>;
}): Promise<void> {
	const targets = options.githubUrl
		? [...YANK_TARGETS, { key: "G", target: "github" as const, label: "GitHub URL" }]
		: YANK_TARGETS;
	return new Promise<void>((resolvePopup) => {
		let settled = false;
		const { popup, close } = createPopupChrome({
			screen: options.screen,
			title: "Copy Task Reference",
			helpText: " {cyan-fg}[↑↓/jk]{/} Navigate | {cyan-fg}[Enter]{/} Select | {cyan-fg}[Esc]{/} Cancel",
			width: 56,
			height: 9,
		});
		const content = box({
			parent: popup,
			top: 1,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			style: { bg: "default" },
		});
		const picker = list({
			parent: content,
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			items: targets.map(({ key, label }) => `{cyan-fg}[${key}]{/} ${label}`),
			selected: 0,
			keys: true,
			mouse: true,
			tags: true,
			style: {
				bg: "default",
				selected: { inverse: true, bold: true },
				item: { bg: "default", hover: { inverse: true } },
			},
		});
		picker.select(0);

		const finish = async (target: YankTarget | null) => {
			if (settled) return;
			settled = true;
			if (target) {
				const value = getYankValue(target);
				if (!value) {
					options.onFeedback(
						target === "relative" ? "Repository-relative path is unavailable" : "Task file path is unavailable",
						false,
					);
				} else {
					const success = await (options.copy ?? copyToClipboard)(value);
					const label =
						target === "id"
							? value
							: target === "relative"
								? "repository-relative path"
								: target === "absolute"
									? "absolute path"
									: "GitHub URL";
					options.onFeedback(success ? `Copied ${label} to clipboard` : "Failed to copy to clipboard", success);
				}
			}
			picker.destroy();
			content.destroy();
			close();
			options.screen.render();
			resolvePopup();
		};

		const choose = (target: YankTarget) => {
			void finish(target);
			return false;
		};
		const chooseSelected = () => {
			const target = targets[picker.selected ?? 0]?.target;
			if (target) void finish(target);
			return false;
		};
		const cancel = () => {
			void finish(null);
			return false;
		};
		picker.on("select", (...args: unknown[]) => {
			const index =
				typeof args[1] === "number" ? args[1] : typeof args[0] === "number" ? args[0] : (picker.selected ?? 0);
			const target = targets[index]?.target;
			if (target) void finish(target);
		});
		function getYankValue(target: YankTarget): string | null {
			if (target === "id") return options.task.id;
			if (target === "github") return options.githubUrl ?? null;
			if (!options.task.filePath) return null;
			const taskPath = resolve(options.projectRoot, options.task.filePath);
			if (target === "absolute") return taskPath;
			if (!options.repositoryRoot) return null;
			return relative(options.repositoryRoot, taskPath);
		}

		for (const { key, target } of targets) {
			picker.key([key.toLowerCase(), key], () => choose(target));
		}
		picker.key(["enter"], chooseSelected);
		picker.key(["escape", "q", "Q"], cancel);
		popup.key(["escape", "q", "Q"], cancel);
		picker.key(["k"], () => {
			picker.select(Math.max(0, (picker.selected ?? 0) - 1));
			options.screen.render();
			return false;
		});
		picker.key(["j"], () => {
			picker.select(Math.min(targets.length - 1, (picker.selected ?? 0) + 1));
			options.screen.render();
			return false;
		});

		setImmediate(() => {
			if (settled) return;
			picker.focus();
			options.screen.render();
		});
	});
}
