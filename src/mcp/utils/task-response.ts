import { formatTaskPlainText } from "../../formatters/task-plain-text.ts";
import type { Task } from "../../types/index.ts";
import type { CallToolResult } from "../types.ts";

export async function formatTaskCallResult(task: Task, summaryLines: string[] = []): Promise<CallToolResult> {
	const formattedTask = formatTaskPlainText(task);
	const summary = summaryLines.filter((line) => line.trim().length > 0).join("\n");
	const text = summary ? `${summary}\n\n${formattedTask}` : formattedTask;

	return {
		content: [
			{
				type: "text",
				text,
			},
		],
	};
}
