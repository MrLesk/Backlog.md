import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { Command } from "commander";
import { Core, initializeGitRepository, isGitRepository } from "./index.ts";

const program = new Command();
program.name("backlog").description("Backlog project management CLI");

program
	.command("init <projectName>")
	.description("initialize backlog project in the current repository")
	.action(async (projectName: string) => {
		try {
			const cwd = process.cwd();
			const isRepo = await isGitRepository(cwd);

			if (!isRepo) {
				const rl = createInterface({ input, output });
				const answer = (await rl.question("No git repository found. Initialize one here? [y/N] ")).trim().toLowerCase();
				rl.close();

				if (answer.startsWith("y")) {
					await initializeGitRepository(cwd);
				} else {
					console.log("Aborting initialization.");
					process.exit(1);
					return;
				}
			}

			const core = new Core(cwd);
			await core.initializeProject(projectName);
			console.log(`Initialized backlog project: ${projectName}`);
		} catch (err) {
			console.error("Failed to initialize project", err);
			process.exitCode = 1;
		}
	});

program.parseAsync(process.argv);
