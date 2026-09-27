import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import type { ProgramInterface } from "neo-neo-bblessed";
import { program as createProgram } from "neo-neo-bblessed";
import { keepTuiInputAlive } from "../ui/tui.ts";

class TestInput extends EventEmitter {
	isRaw = true;
	destroyed = false;
	pauseCalls = 0;
	rawModes: boolean[] = [];

	setRawMode(enabled: boolean): this {
		this.isRaw = enabled;
		this.rawModes.push(enabled);
		return this;
	}

	pause(): this {
		this.pauseCalls += 1;
		return this;
	}

	resume(): this {
		return this;
	}
}

class TestOutput extends EventEmitter {
	isTTY = true;
	columns = 80;
	rows = 24;

	write(): boolean {
		return true;
	}
}

describe("TUI input lifecycle", () => {
	it("keeps stdin active between screen programs and restores it after the session", () => {
		const input = new TestInput();
		const output = new TestOutput();
		const release = keepTuiInputAlive(input as unknown as NodeJS.ReadStream, output as unknown as NodeJS.WriteStream);
		const screenProgram: ProgramInterface = createProgram({ tput: false, input, output });

		screenProgram.destroy();

		expect(input.pauseCalls).toBe(0);
		expect(input.rawModes).toEqual([]);

		release();

		expect(input.pauseCalls).toBe(1);
		expect(input.rawModes).toEqual([false]);

		release();
		expect(input.pauseCalls).toBe(1);
	});
});
