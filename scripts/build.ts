import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import tailwind from "bun-plugin-tailwind";

type PackageJson = {
	version: string;
};

const packageJson = (await Bun.file("package.json").json()) as PackageJson;
const outfile = process.env.BACKLOG_BUILD_OUTFILE ?? "dist/backlog";
const outdir = process.env.BACKLOG_BUILD_OUTDIR;
const version = process.env.BACKLOG_BUILD_VERSION ?? packageJson.version;
const target = process.env.BACKLOG_BUILD_TARGET;
const executablePath = process.env.BACKLOG_BUILD_EXECUTABLE_PATH;
const aot = process.env.BACKLOG_BUILD_AOT === "1";
const trim = process.env.BACKLOG_BUILD_TRIM === "1";
if (aot || trim) {
	if (outdir) throw new Error("AOT and trim require a compiled executable, not BACKLOG_BUILD_OUTDIR");
	if (executablePath && executablePath !== process.execPath) {
		throw new Error("Experimental builds must embed the running compiler; omit BACKLOG_BUILD_EXECUTABLE_PATH");
	}
	const help = Bun.spawnSync([process.execPath, "build", "--help"]).stdout.toString();
	for (const flag of [aot && "--aot ", trim && "--trim "]) {
		if (flag && !help.includes(flag)) throw new Error(`The running compiler does not support ${flag.trim()}`);
	}
}
if (!outdir && target && !executablePath) {
	throw new Error("Cross-target builds require a checksum-verified BACKLOG_BUILD_EXECUTABLE_PATH");
}
const outputDirectory = outdir ?? dirname(outfile);

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
	...(outdir
		? { outdir }
		: {
				format: "esm",
				bytecode: !aot,
				compile: {
					outfile,
					...(aot ? { aot: true } : {}),
					...(trim ? { trim: true } : {}),
					...(executablePath ? { executablePath } : {}),
					...(target ? { target: target as Bun.Build.CompileTarget } : {}),
				},
			}),
	throw: false,
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}
