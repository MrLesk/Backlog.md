/**
 * Default directory structure for backlog projects
 */
export const DEFAULT_DIRECTORIES = {
	/** Main backlog directory */
	BACKLOG: "backlog",
	/** Active tasks directory */
	TASKS: "tasks",
	/** Draft tasks directory */
	DRAFTS: "drafts",
	/** Completed tasks directory */
	COMPLETED: "completed",
	/** Archive root directory */
	ARCHIVE: "archive",
	/** Archived tasks directory */
	ARCHIVE_TASKS: "archive/tasks",
	/** Archived drafts directory */
	ARCHIVE_DRAFTS: "archive/drafts",
	/** Documentation directory */
	DOCS: "docs",
	/** Decision logs directory */
	DECISIONS: "decisions",
	/** Milestones directory */
	MILESTONES: "milestones",
} as const;

/**
 * Default configuration file names
 */
export const DEFAULT_FILES = {
	/** Main configuration file */
	CONFIG: "config.yml",
	/** Local user settings file */
	USER: ".user",
} as const;

/**
 * Default task statuses
 */
export const DEFAULT_STATUSES = ["To Do", "In Progress", "Done"] as const;

/**
 * Fallback status when no default is configured
 */
export const FALLBACK_STATUS = "To Do";

/**
 * Maximum width for wrapped text lines in UI components
 */
export const WRAP_LIMIT = 72;

/**
 * Default values for advanced configuration options used during project initialization.
 * Shared between CLI and browser wizard to ensure consistent defaults.
 */
export const DEFAULT_INIT_CONFIG = {
	checkActiveBranches: true,
	remoteOperations: true,
	activeBranchDays: 30,
	bypassGitHooks: false,
	autoCommit: false,
	zeroPaddedIds: undefined as number | undefined,
	defaultEditor: undefined as string | undefined,
	defaultPort: 6420,
	autoOpenBrowser: true,
} as const;

export * from "../guidelines/index.ts";
