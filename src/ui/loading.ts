import blessed from "blessed";
import { createScreen } from "./tui.ts";

/**
 * Interface for loading screens that can be updated with progress messages.
 */
export interface LoadingScreen {
	/** Update the loading screen with a new progress message */
	update: (message: string) => void;
	/** Close the loading screen and clean up resources */
	close: () => void;
}

// Shared constants
const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 100;

/**
 * Configuration options for creating loading screens.
 * @internal
 */
interface LoadingScreenConfig {
	/** Title for the loading screen window */
	title?: string;
	/** Initial message to display */
	message: string;
	/** Width of the loading box (default: "50%") */
	width?: string | number;
	/** Height of the loading box in rows (default: 7) */
	height?: number;
	/** Whether to show a spinner animation (default: true) */
	showSpinner?: boolean;
	/** Position of the spinner within the screen (default: "center") */
	spinnerPosition?: "center" | "bottom";
	/** Whether the loading box should be scrollable (default: false) */
	allowScrolling?: boolean;
}

/**
 * Creates the basic loading screen components shared by both loading functions.
 * Handles TTY fallback and common setup including spinner animation and keyboard shortcuts.
 * @internal
 * @param config - Configuration options for the loading screen
 * @returns Base loading screen components and control functions
 */
function createLoadingScreenBase(config: LoadingScreenConfig): {
	screen: blessed.Widgets.Screen | null;
	loadingBox: blessed.Widgets.BoxElement | null;
	spinner: blessed.Widgets.TextElement | null;
	spinnerInterval: NodeJS.Timeout | null;
	closed: boolean;
	update: (message: string) => void;
	close: () => void;
} {
	const {
		title = "Loading...",
		message,
		width = "50%",
		height = 7,
		showSpinner = true,
		spinnerPosition = "center",
		allowScrolling = false,
	} = config;

	// Non-TTY fallback
	if (!process.stdout.isTTY) {
		console.log(`${message}...`);
		return {
			screen: null,
			loadingBox: null,
			spinner: null,
			spinnerInterval: null,
			closed: false,
			update: (msg) => console.log(`  ${msg}...`),
			close: () => {},
		};
	}

	// Create blessed screen
	const screen = createScreen({ title });
	let closed = false;

	// Create loading box with proper border - ensure right border renders
	const terminalWidth = process.stdout.columns || 80;
	const boxWidth = Math.min(70, terminalWidth - 8); // Larger width to prevent text wrapping

	const loadingBox = blessed.box({
		parent: screen,
		top: "center",
		left: "center",
		width: boxWidth,
		height: Math.min(height, 6), // Keep it compact
		border: {
			type: "line",
		},
		style: {
			border: { fg: "cyan" },
		},
		label: " Loading ",
		padding: {
			left: 0,
			right: 0,
			top: 0,
			bottom: 0,
		},
		scrollable: allowScrolling,
		alwaysScroll: allowScrolling,
		// Additional properties to ensure proper rendering
		tags: false,
		wrap: false,
		autoPadding: false,
	});

	// Create spinner in the title if requested
	let spinnerInterval: NodeJS.Timeout | null = null;
	let spinnerIndex = 0;

	if (showSpinner) {
		// Start spinner animation in the title
		spinnerInterval = setInterval(() => {
			spinnerIndex = (spinnerIndex + 1) % SPINNER_CHARS.length;
			const spinnerChar = SPINNER_CHARS[spinnerIndex];
			loadingBox.setLabel(` ${spinnerChar} Loading `);
			screen.render();
		}, SPINNER_INTERVAL_MS);

		// Set initial spinner in label
		loadingBox.setLabel(` ${SPINNER_CHARS[0]} Loading `);
	}

	// Handle escape/Ctrl+C to close
	screen.key(["escape", "C-c"], () => {
		if (!closed) {
			closed = true;
			if (spinnerInterval) clearInterval(spinnerInterval);
			screen.destroy();
		}
	});

	// Close function
	const close = () => {
		if (!closed) {
			closed = true;
			if (spinnerInterval) clearInterval(spinnerInterval);
			screen.destroy();
		}
	};

	return {
		screen,
		loadingBox,
		spinner: null, // No longer used - spinner is in the title
		spinnerInterval,
		closed,
		update: () => {}, // Will be overridden by specific implementations
		close,
	};
}

/**
 * Show a loading screen while an async operation runs.
 * Falls back to console.log if blessed is not available.
 *
 * @param message - The message to display during loading
 * @param operation - The async operation to run while showing the loading screen
 * @returns The result of the async operation
 *
 * @example
 * const result = await withLoadingScreen("Loading data", async () => {
 *   return await fetchDataFromAPI();
 * });
 */
export async function withLoadingScreen<T>(message: string, operation: () => Promise<T>): Promise<T> {
	const base = createLoadingScreenBase({
		message,
		width: 60, // Larger width to prevent wrapping
		height: 5, // Compact height
		showSpinner: true,
		spinnerPosition: "center",
	});

	// Non-TTY fallback handled in base
	if (!base.screen) {
		return operation();
	}

	// Add message text to loading box - ensure it doesn't overlap borders
	if (base.loadingBox) {
		blessed.text({
			parent: base.loadingBox,
			top: 0,
			left: 2, // More space from left border
			width: "100%-6", // Account for borders + padding (2 borders + 4 padding)
			height: 1,
			align: "center",
			content: message,
			style: { fg: "white" },
		});
	}

	base.screen.render();

	// Small delay to ensure loading screen renders before heavy async work starts
	// This is especially important on Windows where the terminal might block
	await new Promise((resolve) => setTimeout(resolve, 10));

	try {
		const result = await operation();
		base.close();
		return result;
	} catch (error) {
		base.close();
		throw error;
	}
}

/**
 * Create a loading screen that can be updated with progress messages.
 * Useful for multi-step operations where you need to show progress updates.
 *
 * @param initialMessage - The initial message to display
 * @returns A LoadingScreen interface with update and close methods, or null if creation fails
 *
 * @example
 * const loader = await createLoadingScreen("Starting process");
 * loader?.update("Step 1: Loading data...");
 * // ... perform operations ...
 * loader?.update("Step 2: Processing...");
 * // ... more operations ...
 * loader?.close();
 */
export async function createLoadingScreen(initialMessage: string): Promise<LoadingScreen | null> {
	const base = createLoadingScreenBase({
		message: initialMessage,
		width: 70, // Larger width to prevent wrapping
		height: 6, // Smaller height for better proportions
		showSpinner: true,
		spinnerPosition: "bottom",
		allowScrolling: true,
	});

	// Non-TTY fallback handled in base
	if (!base.screen) {
		return {
			update: base.update,
			close: base.close,
		};
	}

	// Progress messages area
	if (!base.loadingBox) {
		return {
			update: base.update,
			close: base.close,
		};
	}

	const messages = blessed.log({
		parent: base.loadingBox,
		top: 0,
		left: 2, // More space from left border
		width: "100%-6", // Account for borders + padding (2 borders + 4 padding)
		height: "100%-2", // Account for top and bottom borders
		tags: true,
		style: { fg: "white" },
		wrap: true, // Ensure long lines wrap instead of extending beyond width
	});

	// Add initial message
	messages.log(initialMessage);
	base.screen.render();

	// Small delay to ensure loading screen renders before returning control
	// This is especially important on Windows where the terminal might block
	await new Promise((resolve) => setTimeout(resolve, 10));

	// Override update function to use the log widget
	base.update = (message: string) => {
		if (!base.closed) {
			messages.log(message);
			if (base.screen) {
				base.screen.render();
			}
		}
	};

	return {
		update: base.update,
		close: base.close,
	};
}
