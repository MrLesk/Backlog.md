import blessed from "blessed";
import type { Sequence } from "../types/index.ts";

/**
 * Display sequences in an interactive TUI using blessed
 */
export async function viewSequencesTUI(sequences: Sequence[]): Promise<void> {
	const screen = blessed.screen({
		smartCSR: true,
		title: "Task Sequences",
	});

	// Main container
	const container = blessed.box({
		parent: screen,
		top: 0,
		left: 0,
		width: "100%",
		height: "100%",
		style: {
			fg: "white",
			bg: "black",
		},
	});

	// Title
	const title = blessed.text({
		parent: container,
		top: 0,
		left: "center",
		content: "Task Sequences - Interactive View",
		style: {
			fg: "cyan",
			bold: true,
		},
	});

	// Instructions
	const instructions = blessed.text({
		parent: container,
		bottom: 0,
		left: 0,
		width: "100%",
		content: " ↑/↓: Navigate sequences | ←/→: Navigate tasks | q: Quit | Enter: View task details",
		style: {
			fg: "gray",
			bg: "black",
		},
	});

	// Scrollable content area
	const contentArea = blessed.box({
		parent: container,
		top: 2,
		left: 1,
		right: 1,
		bottom: 2,
		scrollable: true,
		alwaysScroll: true,
		mouse: true,
		keys: true,
		vi: true,
		style: {
			fg: "white",
			bg: "black",
		},
		scrollbar: {
			ch: " ",
			track: {
				bg: "gray",
			},
			style: {
				inverse: true,
			},
		},
	});

	// Build content
	let content = "";
	let currentLine = 0;
	const taskLocations: Array<{ line: number; sequenceIndex: number; taskIndex: number }> = [];

	for (let seqIndex = 0; seqIndex < sequences.length; seqIndex++) {
		const sequence = sequences[seqIndex];

		// Sequence header
		content += `{cyan-fg}{bold}Sequence ${sequence.number}{/bold}{/cyan-fg}\n`;
		currentLine++;

		if (sequence.tasks.length === 0) {
			content += "  {gray-fg}(No tasks){/gray-fg}\n";
			currentLine++;
		} else {
			for (let taskIndex = 0; taskIndex < sequence.tasks.length; taskIndex++) {
				const task = sequence.tasks[taskIndex];
				if (!task) continue;

				const priorityColor = task.priority === "high" ? "red" : task.priority === "medium" ? "yellow" : "green";
				const priorityIndicator = task.priority
					? `{${priorityColor}-fg}[${task.priority.toUpperCase()}]{/${priorityColor}-fg} `
					: "";

				// Store task location for navigation
				taskLocations.push({ line: currentLine, sequenceIndex: seqIndex, taskIndex });

				content += `  ${priorityIndicator}{white-fg}${task.id}{/white-fg} - ${task.title}\n`;
				currentLine++;
			}
		}

		// Add spacing between sequences
		if (seqIndex < sequences.length - 1) {
			content += "\n";
			currentLine++;
		}
	}

	contentArea.setContent(content);

	// Current selection tracking
	let selectedTaskIndex = 0;
	let selectedLine = taskLocations.length > 0 && taskLocations[0] ? taskLocations[0].line : 0;

	// Highlight current selection
	function highlightSelection() {
		if (taskLocations.length === 0) return;

		const location = taskLocations[selectedTaskIndex];
		if (!location) return;

		selectedLine = location.line;

		// Scroll to selection
		const viewportHeight = (contentArea.height as number) - 2;
		const scrollOffset = Math.max(0, selectedLine - Math.floor(viewportHeight / 2));
		contentArea.scrollTo(scrollOffset);

		screen.render();
	}

	// Navigation handlers
	contentArea.key(["up", "k"], () => {
		if (selectedTaskIndex > 0) {
			selectedTaskIndex--;
			highlightSelection();
		}
	});

	contentArea.key(["down", "j"], () => {
		if (selectedTaskIndex < taskLocations.length - 1) {
			selectedTaskIndex++;
			highlightSelection();
		}
	});

	contentArea.key(["left", "h"], () => {
		// Move to previous task in same sequence or previous sequence
		if (selectedTaskIndex > 0) {
			const currentLocation = taskLocations[selectedTaskIndex];
			const prevLocation = taskLocations[selectedTaskIndex - 1];

			// If in same sequence, just move up
			if (currentLocation && prevLocation && currentLocation.sequenceIndex === prevLocation.sequenceIndex) {
				selectedTaskIndex--;
			} else {
				// Move to first task of previous sequence
				for (let i = selectedTaskIndex - 1; i >= 0; i--) {
					const loc = taskLocations[i];
					if (loc && loc.taskIndex === 0) {
						selectedTaskIndex = i;
						break;
					}
				}
			}
			highlightSelection();
		}
	});

	contentArea.key(["right", "l"], () => {
		// Move to next task in same sequence or next sequence
		if (selectedTaskIndex < taskLocations.length - 1) {
			const currentLocation = taskLocations[selectedTaskIndex];
			const nextLocation = taskLocations[selectedTaskIndex + 1];

			// If in same sequence, just move down
			if (currentLocation && nextLocation && currentLocation.sequenceIndex === nextLocation.sequenceIndex) {
				selectedTaskIndex++;
			} else {
				// Move to first task of next sequence
				for (let i = selectedTaskIndex + 1; i < taskLocations.length; i++) {
					const loc = taskLocations[i];
					if (loc && loc.taskIndex === 0) {
						selectedTaskIndex = i;
						break;
					}
				}
			}
			highlightSelection();
		}
	});

	contentArea.key(["enter"], async () => {
		const location = taskLocations[selectedTaskIndex];
		if (!location) return;

		const sequence = sequences[location.sequenceIndex];
		if (!sequence) return;

		const task = sequence.tasks[location.taskIndex];
		if (!task) return;

		// Display task details in a popup
		const popup = blessed.box({
			parent: screen,
			top: "center",
			left: "center",
			width: "80%",
			height: "80%",
			border: {
				type: "line",
			},
			style: {
				fg: "white",
				bg: "black",
				border: {
					fg: "cyan",
				},
			},
			label: ` Task ${task.id} `,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
		});

		let details = `{bold}${task.title}{/bold}\n\n`;
		details += `ID: ${task.id}\n`;
		details += `Status: ${task.status}\n`;
		if (task.assignee.length > 0) {
			details += `Assignee: ${task.assignee.join(", ")}\n`;
		}
		if (task.priority) {
			details += `Priority: ${task.priority}\n`;
		}
		if (task.labels.length > 0) {
			details += `Labels: ${task.labels.join(", ")}\n`;
		}
		if (task.dependencies.length > 0) {
			details += `Dependencies: ${task.dependencies.join(", ")}\n`;
		}
		details += "\nPress ESC or q to close";

		popup.setContent(details);

		popup.key(["escape", "q"], () => {
			popup.destroy();
			screen.render();
		});

		popup.focus();
		screen.render();
	});

	// Quit handlers
	contentArea.key(["q", "escape"], () => {
		process.exit(0);
	});

	screen.key(["q", "C-c"], () => {
		process.exit(0);
	});

	// Focus and render
	contentArea.focus();
	highlightSelection();
	screen.render();

	// Return a promise that resolves when the screen is destroyed
	return new Promise((resolve) => {
		screen.on("destroy", resolve);
	});
}
