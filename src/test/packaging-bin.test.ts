import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("package bin wrapper", () => {
	it("points to scripts/cli.cjs to own .bin/backlog", async () => {
		const pkgPath = join(process.cwd(), "package.json");
		const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
		expect(pkg?.bin?.backlog).toBe("scripts/cli.cjs");
	});
});
