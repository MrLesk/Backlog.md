import { join } from "node:path";
import { generateKanbanBoard } from "./board.ts";
import type { Task } from "./types/index.ts";

const BOARD_START = "<!-- BOARD_START -->";
const BOARD_END = "<!-- BOARD_END -->";

export async function updateReadmeWithBoard(tasks: Task[], statuses: string[], projectName: string) {
	const readmePath = join(process.cwd(), "README.md");
	let readmeContent = "";
	try {
		readmeContent = await Bun.file(readmePath).text();
	} catch (error) {
		// If README.md doesn't exist, create it.
	}

	const board = generateKanbanBoard(tasks, statuses, projectName);

	const startMarkerIndex = readmeContent.indexOf(BOARD_START);
	const endMarkerIndex = readmeContent.indexOf(BOARD_END);

	const licenseIndex = readmeContent.indexOf("## License");

	if (startMarkerIndex !== -1 && endMarkerIndex !== -1) {
		const preContent = readmeContent.substring(0, startMarkerIndex + BOARD_START.length);
		const postContent = readmeContent.substring(endMarkerIndex);
		readmeContent = `${preContent}\n\n${board}\n\n${postContent}`;
	} else if (licenseIndex !== -1) {
		const preContent = readmeContent.substring(0, licenseIndex);
		const postContent = readmeContent.substring(licenseIndex);
		readmeContent = `${preContent}${BOARD_START}\n\n${board}\n\n${BOARD_END}\n\n${postContent}`;
	} else {
		// If markers are not found, append the board at the end of the file.
		readmeContent += `\n\n${BOARD_START}\n\n${board}\n\n${BOARD_END}`;
	}

	await Bun.write(readmePath, readmeContent);
}
