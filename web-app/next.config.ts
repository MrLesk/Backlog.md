import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	experimental: {
		optimizePackageImports: ["@uiw/react-md-editor", "@uiw/react-markdown-preview"],
	},
};

export default nextConfig;
