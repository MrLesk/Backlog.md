// Types
export * from "./types/index.ts";

// Constants
export * from "./constants/index.ts";

// Markdown operations
export * from "./markdown/parser.ts";
export * from "./markdown/serializer.ts";

// File system operations
export { FileSystem } from "./file-system/operations.ts";

// Git operations
export {
	GitOperations,
	isGitRepository,
	initializeGitRepository,
} from "./git/operations.ts";

// Core entry point
export { Core } from "./core/backlog.ts";

// Kanban board utilities
export { generateKanbanBoard, exportKanbanBoardToFile } from "./board.ts";
export { addAgentInstructions, type AgentInstructionFile } from "./agent-instructions.ts";
