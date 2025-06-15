import { describe, expect, it } from "bun:test";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getBinaryName } = require("../../scripts/getBinaryName.cjs");

describe("getBinaryName", () => {
	it("appends .exe on Windows", () => {
		expect(getBinaryName("win32", "x64")).toBe("backlog-bun-windows-x64.exe");
	});
});
