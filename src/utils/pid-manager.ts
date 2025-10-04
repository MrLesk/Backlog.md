import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

/**
 * Default PID file location for MCP server
 */
export const MCP_PID_FILE = "/tmp/backlog-mcp-server.pid";

/**
 * Write PID to file for daemon process tracking
 * @param pid - Process ID to write
 * @param pidFile - Path to PID file (defaults to MCP_PID_FILE)
 */
export function writePidFile(pid: number, pidFile: string = MCP_PID_FILE): void {
	try {
		writeFileSync(pidFile, pid.toString(), "utf8");
	} catch (error) {
		console.error("Warning: Failed to write PID file:", error instanceof Error ? error.message : error);
	}
}

/**
 * Read PID from file
 * @param pidFile - Path to PID file (defaults to MCP_PID_FILE)
 * @returns Process ID or null if file doesn't exist or is invalid
 */
export function readPidFile(pidFile: string = MCP_PID_FILE): number | null {
	try {
		if (!existsSync(pidFile)) {
			return null;
		}
		const pidString = readFileSync(pidFile, "utf8").trim();
		const pid = Number.parseInt(pidString, 10);
		return Number.isNaN(pid) ? null : pid;
	} catch {
		return null;
	}
}

/**
 * Remove PID file
 * @param pidFile - Path to PID file (defaults to MCP_PID_FILE)
 */
export function removePidFile(pidFile: string = MCP_PID_FILE): void {
	try {
		if (existsSync(pidFile)) {
			unlinkSync(pidFile);
		}
	} catch {
		// Ignore errors when removing PID file
	}
}

/**
 * Check if a process with given PID is currently running
 * @param pid - Process ID to check
 * @returns true if process is running, false otherwise
 */
export function isProcessRunning(pid: number): boolean {
	try {
		// process.kill with signal 0 checks if process exists without killing it
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Clean up stale PID file (when process is no longer running)
 * @param pidFile - Path to PID file (defaults to MCP_PID_FILE)
 * @returns true if stale PID file was cleaned up, false otherwise
 */
export function cleanupStaleProcess(pidFile: string = MCP_PID_FILE): boolean {
	const pid = readPidFile(pidFile);
	if (pid && !isProcessRunning(pid)) {
		removePidFile(pidFile);
		return true;
	}
	return false;
}
