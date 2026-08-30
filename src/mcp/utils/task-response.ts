import type { TaskDetail } from "../../core/task-detail.ts";
import { formatTaskPlainText } from "../../formatters/task-plain-text.ts";
import type { CallToolResult } from "../types.ts";

/** Every MCP task result renders through the one plain serializer, so they all read the same. */
export async function formatTaskCallResult(
	task: TaskDetail,
	summaryLines: string[] = [],
	options: Parameters<typeof formatTaskPlainText>[1] = {},
): Promise<CallToolResult> {
	const formattedTask = formatTaskPlainText(task, options);
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
