import { describe, expect, it } from "bun:test";
import { isLoopbackBrowserHostname, normalizeBrowserHostname } from "../utils/browser-host.ts";

describe("browser hostname input", () => {
	it.each([
		["127.0.0.1", "127.0.0.1"],
		[" LOCALHOST ", "localhost"],
		["0.0.0.0", "0.0.0.0"],
		["board.example.com", "board.example.com"],
		["[::1]", "::1"],
		["0:0:0:0:0:0:0:1", "::1"],
		["::", "::"],
	])("accepts and normalizes %s", (input, expected) => {
		expect(normalizeBrowserHostname(input)).toBe(expected);
	});

	it.each([
		"",
		"http://localhost",
		"localhost:6420",
		"localhost/path",
		"user@localhost",
		"foo bar",
		"-bad",
		"a..b",
		"*",
		"localhost?x=1",
		"[invalid]",
		false,
		null,
		6420,
	])("rejects a value that is not a listening hostname: %s", (input) => {
		expect(() => normalizeBrowserHostname(input)).toThrow("hostname");
	});

	it.each(["127.0.0.1", "127.0.0.2", "::1", "0:0:0:0:0:0:0:1", "::ffff:127.0.0.1", "localhost", "localhost."])(
		"identifies local-only host %s",
		(hostname) => expect(isLoopbackBrowserHostname(hostname)).toBe(true),
	);

	it.each(["0.0.0.0", "::", "::ffff:192.168.1.2", "192.168.1.2", "board.example.com"])(
		"does not treat %s as known loopback",
		(hostname) => expect(isLoopbackBrowserHostname(hostname)).toBe(false),
	);
});
