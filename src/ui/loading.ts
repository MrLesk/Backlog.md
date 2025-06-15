import blessed from "blessed";

export interface LoadingScreen {
	update: (message: string) => void;
	close: () => void;
}

/**
 * Show a loading screen while an async operation runs.
 * Falls back to console.log if blessed is not available.
 */
export async function withLoadingScreen<T>(message: string, operation: () => Promise<T>): Promise<T> {
	if (!process.stdout.isTTY) {
		// Fallback: just log the message
		console.log(`${message}...`);
		return operation();
	}

	const screen = blessed.screen({
		smartCSR: true,
		tput: false,
		title: "Loading...",
	});

	// Create loading box
	const loadingBox = blessed.box({
		parent: screen,
		top: "center",
		left: "center",
		width: "50%",
		height: 7,
		border: "line",
		label: " Loading ",
		padding: 1,
		style: {
			border: { fg: "cyan" },
		},
	});

	// Loading message
	const messageText = blessed.text({
		parent: loadingBox,
		top: 0,
		left: "center",
		content: message,
		style: { fg: "white" },
	});

	// Spinner
	const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	let spinnerIndex = 0;

	const spinner = blessed.text({
		parent: loadingBox,
		top: 2,
		left: "center",
		content: spinnerChars[0],
		style: { fg: "cyan" },
	});

	// Start spinner animation
	const spinnerInterval = setInterval(() => {
		spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
		spinner.setContent(spinnerChars[spinnerIndex]);
		screen.render();
	}, 100);

	// Allow escape to cancel (though operation continues)
	let cancelled = false;
	screen.key(["escape", "C-c"], () => {
		cancelled = true;
		clearInterval(spinnerInterval);
		screen.destroy();
	});

	screen.render();

	try {
		const result = await operation();

		// Clean up
		clearInterval(spinnerInterval);
		if (!cancelled) {
			screen.destroy();
		}

		return result;
	} catch (error) {
		// Clean up on error
		clearInterval(spinnerInterval);
		if (!cancelled) {
			screen.destroy();
		}
		throw error;
	}
}

/**
 * Create a loading screen that can be updated with progress messages.
 * Useful for multi-step operations.
 */
export async function createLoadingScreen(initialMessage: string): Promise<LoadingScreen | null> {
	if (!process.stdout.isTTY) {
		// Fallback: return a simple console logger
		console.log(`${initialMessage}...`);
		return {
			update: (msg) => console.log(`  ${msg}...`),
			close: () => {},
		};
	}

	const screen = blessed.screen({
		smartCSR: true,
		tput: false,
		title: "Loading...",
	});

	const loadingBox = blessed.box({
		parent: screen,
		top: "center",
		left: "center",
		width: "60%",
		height: 10,
		border: "line",
		label: " Loading ",
		padding: 1,
		scrollable: true,
		alwaysScroll: true,
		style: {
			border: { fg: "cyan" },
		},
	});

	// Progress messages area
	const messages = blessed.log({
		parent: loadingBox,
		top: 0,
		left: 0,
		width: "100%-2",
		height: "100%-2",
		tags: true,
		style: { fg: "white" },
	});

	// Add initial message
	messages.log(initialMessage);

	// Spinner at bottom
	const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	let spinnerIndex = 0;

	const spinner = blessed.text({
		parent: screen,
		bottom: 1,
		left: "center",
		content: spinnerChars[0],
		style: { fg: "cyan" },
	});

	// Start spinner animation
	const spinnerInterval = setInterval(() => {
		spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
		spinner.setContent(spinnerChars[spinnerIndex]);
		screen.render();
	}, 100);

	// Allow escape to close
	let closed = false;
	screen.key(["escape", "C-c"], () => {
		if (!closed) {
			closed = true;
			clearInterval(spinnerInterval);
			screen.destroy();
		}
	});

	screen.render();

	return {
		update: (message: string) => {
			if (!closed) {
				messages.log(message);
				screen.render();
			}
		},
		close: () => {
			if (!closed) {
				closed = true;
				clearInterval(spinnerInterval);
				screen.destroy();
			}
		},
	};
}
