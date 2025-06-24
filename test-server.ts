import { BacklogServer } from "./src/server/index.ts";

const server = new BacklogServer(process.cwd());
const info = await server.start();
console.log(`Server running at ${info.url}`);
