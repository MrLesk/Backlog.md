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
		rollupOptions: {
			output: {
				entryFileNames: "assets/index.js",
				chunkFileNames: "assets/[name].js",
				assetFileNames: (assetInfo) => {
					if (assetInfo.name && assetInfo.name.endsWith(".css")) {
						return "assets/index.css";
					}
					if (assetInfo.name && assetInfo.name.endsWith(".png")) {
						return "assets/logo.png";
					}
					return "assets/[name].[ext]";
				},
			},
		},
	},
});
