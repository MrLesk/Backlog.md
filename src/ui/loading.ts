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

	// Create loading box
	const loadingBox = blessed.box({
		parent: screen,
		top: "center",
		left: "center",
		width,
		height,
		border: "line",
		label: " Loading ",
		padding: 1,
		scrollable: allowScrolling,
		alwaysScroll: allowScrolling,
		style: {
			border: { fg: "cyan" },
		},
	});

	// Create spinner if requested
	let spinner: blessed.Widgets.TextElement | null = null;
	let spinnerInterval: NodeJS.Timeout | null = null;
	let spinnerIndex = 0;

	if (showSpinner) {
		spinner = blessed.text({
			parent: spinnerPosition === "center" ? loadingBox : screen,
			top: spinnerPosition === "center" ? 2 : undefined,
			bottom: spinnerPosition === "bottom" ? 1 : undefined,
			left: "center",
			content: SPINNER_CHARS[0],
			style: { fg: "cyan" },
		});

		// Start spinner animation
		spinnerInterval = setInterval(() => {
			spinnerIndex = (spinnerIndex + 1) % SPINNER_CHARS.length;
			if (spinner) {
				spinner.setContent(SPINNER_CHARS[spinnerIndex]);
			}
			screen.render();
		}, SPINNER_INTERVAL_MS);
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
		spinner,
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
		showSpinner: true,
		spinnerPosition: "center",
	});

	// Non-TTY fallback handled in base
	if (!base.screen) {
		return operation();
	}

	// Add message text to loading box
	if (base.loadingBox) {
		blessed.text({
			parent: base.loadingBox,
			top: 0,
			left: "center",
			content: message,
			style: { fg: "white" },
		});
	}

	base.screen.render();

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
		width: "60%",
		height: 10,
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
		left: 0,
		width: "100%-2",
		height: "100%-2",
		tags: true,
		style: { fg: "white" },
	});

	// Add initial message
	messages.log(initialMessage);
	base.screen.render();

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
