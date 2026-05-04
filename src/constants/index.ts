/**
 * Default directory structure for backlog projects
 */
export const DEFAULT_DIRECTORIES = {
	/** Main backlog directory */
	BACKLOG: "backlog",
	/** Hidden backlog directory */
	HIDDEN_BACKLOG: ".backlog",
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
	/** Archived milestones directory */
	ARCHIVE_MILESTONES: "archive/milestones",
	/** Documentation directory */
	DOCS: "docs",
	/** Decision logs directory */
	DECISIONS: "decisions",
	/** Milestones directory */
	MILESTONES: "milestones",
} as const;

/**
 * Default file naming prefixes for persisted backlog items.
 */
export const DEFAULT_FILE_PREFIXES = {
	/** Task file prefix (e.g., task-1.md) */
	TASK: "task-",
	/** Draft file prefix (e.g., draft-1.md) */
	DRAFT: "draft-",
	/** Milestone file prefix (e.g., m-1 - Milestone-slug.md) */
	MILESTONE: "m-",
	/** Decision file prefix (e.g., decision-1 - Decision-slug.md) */
	DECISION: "decision-",
	/** Document file prefix (e.g., doc-1 - Some-Document.md) */
	DOC: "doc-",
} as const;

/**
 * Default configuration file names
 */
export const DEFAULT_FILES = {
	/** Main configuration file */
	CONFIG: "config.yml",
	/** Alternate config filename accepted for discovery */
	CONFIG_YAML: "config.yaml",
	/** Root-level backlog configuration file */
	ROOT_CONFIG: "backlog.config.yml",
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
	filesystemOnly: false,
	zeroPaddedIds: undefined as number | undefined,
	defaultEditor: undefined as string | undefined,
	defaultPort: 6420,
	autoOpenBrowser: true,
} as const;

export const DECISION_ID_PREFIX_RE = new RegExp(`^${DEFAULT_FILE_PREFIXES.DECISION}(\\d+)$`);
export const DOC_ID_PREFIX_RE = new RegExp(`^${DEFAULT_FILE_PREFIXES.DOC}(\\d+)$`);

export * from "../guidelines/index.ts";
