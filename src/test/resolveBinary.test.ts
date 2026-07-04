import { describe, expect, it } from "bun:test";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
	getPackageName,
	getCandidatePackageNames,
	isRosettaTranslated,
	resolveBinaryPath,
} = require("../../scripts/resolveBinary.cjs");

function resolverFor(available: string[]) {
	return (specifier: string) => {
		if (!available.includes(specifier)) {
			throw new Error(`Cannot find module '${specifier}'`);
		}
		return `/node_modules/${specifier}`;
	};
}

describe("getPackageName", () => {
	it("maps win32 platform to windows package", () => {
		expect(getPackageName("win32", "x64")).toBe("backlog.md-windows-x64");
	});

	it("maps win32 arm64 to windows-arm64 package", () => {
		expect(getPackageName("win32", "arm64")).toBe("backlog.md-windows-arm64");
	});

	it("returns linux name unchanged", () => {
		expect(getPackageName("linux", "arm64")).toBe("backlog.md-linux-arm64");
	});

	it("maps darwin arches to darwin packages", () => {
		expect(getPackageName("darwin", "arm64")).toBe("backlog.md-darwin-arm64");
		expect(getPackageName("darwin", "x64")).toBe("backlog.md-darwin-x64");
	});
});

describe("getCandidatePackageNames", () => {
	it("tries the sibling darwin arch after the native one on macOS", () => {
		expect(getCandidatePackageNames("darwin", "arm64")).toEqual(["backlog.md-darwin-arm64", "backlog.md-darwin-x64"]);
		expect(getCandidatePackageNames("darwin", "x64")).toEqual(["backlog.md-darwin-x64", "backlog.md-darwin-arm64"]);
	});

	it("does not add fallbacks on other platforms", () => {
		expect(getCandidatePackageNames("linux", "x64")).toEqual(["backlog.md-linux-x64"]);
		expect(getCandidatePackageNames("linux", "arm64")).toEqual(["backlog.md-linux-arm64"]);
		expect(getCandidatePackageNames("win32", "x64")).toEqual(["backlog.md-windows-x64"]);
	});

	it("does not add fallbacks for unknown darwin arches", () => {
		expect(getCandidatePackageNames("darwin", "ppc64")).toEqual(["backlog.md-darwin-ppc64"]);
	});
});

describe("resolveBinaryPath", () => {
	it("resolves the native package when it is installed", () => {
		const resolver = resolverFor(["backlog.md-darwin-arm64/backlog", "backlog.md-darwin-x64/backlog"]);
		expect(resolveBinaryPath("darwin", "arm64", resolver)).toBe("/node_modules/backlog.md-darwin-arm64/backlog");
	});

	it("falls back to darwin-x64 when arm64 Node only has the x64 package", () => {
		const resolver = resolverFor(["backlog.md-darwin-x64/backlog"]);
		expect(resolveBinaryPath("darwin", "arm64", resolver)).toBe("/node_modules/backlog.md-darwin-x64/backlog");
	});

	it("falls back to darwin-arm64 when Rosetta x64 Node only has the arm64 package", () => {
		const resolver = resolverFor(["backlog.md-darwin-arm64/backlog"]);
		expect(resolveBinaryPath("darwin", "x64", resolver)).toBe("/node_modules/backlog.md-darwin-arm64/backlog");
	});

	it("throws the original error when no darwin package is installed", () => {
		expect(() => resolveBinaryPath("darwin", "arm64", resolverFor([]))).toThrow(
			"Cannot find module 'backlog.md-darwin-arm64/backlog'",
		);
	});

	it("does not fall back across arches on linux", () => {
		const resolver = resolverFor(["backlog.md-linux-arm64/backlog"]);
		expect(() => resolveBinaryPath("linux", "x64", resolver)).toThrow(
			"Cannot find module 'backlog.md-linux-x64/backlog'",
		);
	});

	it("resolves the .exe binary on windows", () => {
		const resolver = resolverFor(["backlog.md-windows-x64/backlog.exe"]);
		expect(resolveBinaryPath("win32", "x64", resolver)).toBe("/node_modules/backlog.md-windows-x64/backlog.exe");
	});
});

describe("isRosettaTranslated", () => {
	it("is false off macOS without shelling out", () => {
		expect(isRosettaTranslated("linux")).toBe(false);
		expect(isRosettaTranslated("win32")).toBe(false);
	});

	it("returns a boolean on the current platform", () => {
		expect(typeof isRosettaTranslated()).toBe("boolean");
	});
});
