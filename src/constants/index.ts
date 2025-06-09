/**
 * Default directory structure for backlog projects
 */
export const DEFAULT_DIRECTORIES = {
	/** Main backlog directory */
	BACKLOG: ".backlog",
	/** Active tasks directory */
	TASKS: "tasks",
	/** Draft tasks directory */
	DRAFTS: "drafts",
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
export const DEFAULT_STATUSES = ["Draft", "To Do", "In Progress", "Done"] as const;

/**
 * Fallback status when no default is configured
 */
export const FALLBACK_STATUS = "To Do";

export * from "../guidelines/index.ts";
