import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	root: "./src/web-ui",
	base: "./",
	build: {
		outDir: "/Users/agavr/projects/Backlog.md/dist",
		emptyOutDir: true,
	},
});
