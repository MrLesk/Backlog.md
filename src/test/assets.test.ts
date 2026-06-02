import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, utimes } from "node:fs/promises";
import { join } from "node:path";
import { AssetManager } from "../core/assets.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let assetsRoot: string;
let manager: AssetManager;

describe("AssetManager", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("assets");
		assetsRoot = join(TEST_DIR, "assets");
		await mkdir(join(assetsRoot, ".temp"), { recursive: true });
		manager = new AssetManager(assetsRoot);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("uploads a file to temp directory", async () => {
		const file = new File(["fake-png"], "screenshot.png", { type: "image/png" });
		const result = await manager.uploadFile(file, true);
		expect(result.url).toMatch(/^\/assets\/\.temp\/[\w-]+\.png$/);

		const filename = result.url.replace("/assets/.temp/", "");
		const filePath = join(assetsRoot, ".temp", filename);
		expect(await Bun.file(filePath).exists()).toBe(true);
		expect(await Bun.file(filePath).text()).toBe("fake-png");
	});

	it("uploads from a data URI", async () => {
		const base64 = btoa("hello-image");
		const dataUri = `data:image/png;base64,${base64}`;
		const result = await manager.uploadFromDataUri(dataUri, true);
		expect(result.url).toMatch(/^\/assets\/\.temp\/[\w-]+\.png$/);

		const filename = result.url.replace("/assets/.temp/", "");
		const filePath = join(assetsRoot, ".temp", filename);
		expect(await Bun.file(filePath).exists()).toBe(true);
	});

	it("rejects invalid data URI", async () => {
		await expect(manager.uploadFromDataUri("not-a-data-uri", true)).rejects.toThrow("Invalid data URI");
	});

	it("rejects empty file", async () => {
		const file = new File([], "empty.png", { type: "image/png" });
		await expect(manager.uploadFile(file, true)).rejects.toThrow("Empty file");
	});

	it("promotes temp assets to paste directory", async () => {
		const file = new File(["promote-me"], "test.png", { type: "image/png" });
		const upload = await manager.uploadFile(file, true);

		const mapping = await manager.promote([upload.url]);
		expect(mapping[upload.url]).toMatch(/^\/assets\/paste\/[\w-]+\.png$/);
		const pasteUrl = mapping[upload.url];
		if (!pasteUrl) throw new Error("promote returned empty mapping");

		const tempPath = join(assetsRoot, ".temp", upload.url.replace("/assets/.temp/", ""));
		const pastePath = join(assetsRoot, "paste", pasteUrl.replace("/assets/paste/", ""));

		expect(await Bun.file(tempPath).exists()).toBe(false);
		expect(await Bun.file(pastePath).exists()).toBe(true);
	});

	it("ignores invalid URLs during promote", async () => {
		const mapping = await manager.promote(["/assets/paste/already.png", "/assets/../escape.png"]);
		expect(Object.keys(mapping)).toHaveLength(0);
	});

	it("cleans up old temp files", async () => {
		const file = new File(["old"], "old.png", { type: "image/png" });
		const upload = await manager.uploadFile(file, true);
		const filePath = join(assetsRoot, ".temp", upload.url.replace("/assets/.temp/", ""));

		const agedTime = new Date(Date.now() - 31 * 60 * 1000);
		await utimes(filePath, agedTime, agedTime);

		const result = await manager.cleanup({ maxAgeMs: 30 * 60 * 1000 });
		expect(result.removed).toBe(1);
		expect(await Bun.file(filePath).exists()).toBe(false);
	});

	it("skips fresh files during cleanup", async () => {
		const file = new File(["fresh"], "fresh.png", { type: "image/png" });
		const upload = await manager.uploadFile(file, true);
		const filePath = join(assetsRoot, ".temp", upload.url.replace("/assets/.temp/", ""));

		const result = await manager.cleanup({ maxAgeMs: 30 * 60 * 1000 });
		expect(result.removed).toBe(0);
		expect(await Bun.file(filePath).exists()).toBe(true);
	});

	it("blocks download from localhost", async () => {
		const result = await manager.downloadImage("http://localhost:8080/image.png");
		expect(result).toBeNull();
	});

	it("blocks download from private IP", async () => {
		const result = await manager.downloadImage("http://192.168.1.1/image.png");
		expect(result).toBeNull();
	});

	it("blocks non-http protocols", async () => {
		const result = await manager.downloadImage("ftp://example.com/image.png");
		expect(result).toBeNull();
	});
});
