import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	build: {
		outDir: "dist",
		assetsDir: "assets",
		sourcemap: true,
	},
	server: {
		port: 5173,
	},
});
