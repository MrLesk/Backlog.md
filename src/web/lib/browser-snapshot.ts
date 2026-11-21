import type { BacklogConfig, Decision, Document, Milestone, Task } from "../../types/index.ts";

export const BROWSER_SNAPSHOT_ID = "backlog-snapshot";

export interface BrowserSnapshot {
	version: string;
	config: BacklogConfig;
	tasks: Task[];
	archivedDependencyStatuses: Array<Pick<Task, "id" | "status">>;
	docs: Document[];
	decisions: Decision[];
	milestones: Milestone[];
	tasksOnly: boolean;
}

const snapshotJson = globalThis.document?.getElementById(BROWSER_SNAPSHOT_ID)?.textContent;
export const browserSnapshot: BrowserSnapshot | undefined = snapshotJson ? JSON.parse(snapshotJson) : undefined;
