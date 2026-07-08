import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import tailwind from "bun-plugin-tailwind";

type PackageJson = {
	version: string;
};

const packageJson = (await Bun.file("package.json").json()) as PackageJson;
const outfile = process.env.BACKLOG_BUILD_OUTFILE ?? "dist/backlog";
const version = process.env.BACKLOG_BUILD_VERSION ?? packageJson.version;
const target = process.env.BACKLOG_BUILD_TARGET;
const outputDirectory = dirname(outfile);

if (outputDirectory !== ".") {
	await mkdir(outputDirectory, { recursive: true });
}

const result = await Bun.build({
	entrypoints: ["src/cli.ts"],
	target: "bun",
	minify: true,
	define: {
		__EMBEDDED_VERSION__: JSON.stringify(version),
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	plugins: [tailwind],
	compile: {
		outfile,
		...(target ? { target: target as Bun.Build.CompileTarget } : {}),
	},
	throw: false,
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}
