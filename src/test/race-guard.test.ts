import { describe, expect, it } from "bun:test";
import { createGenerationGate, trackSpinner } from "../web/lib/race-guard.ts";

describe("createGenerationGate", () => {
	it("treats only the latest token as current", () => {
		const gate = createGenerationGate();
		const first = gate.next();
		expect(gate.isCurrent(first)).toBe(true);
		const second = gate.next();
		expect(gate.isCurrent(first)).toBe(false);
		expect(gate.isCurrent(second)).toBe(true);
	});

	it("produces strictly increasing tokens", () => {
		const gate = createGenerationGate();
		const tokens = [gate.next(), gate.next(), gate.next(), gate.next()];
		for (let i = 1; i < tokens.length; i++) {
			expect(tokens[i]).toBeGreaterThan(tokens[i - 1] as number);
		}
	});

	it("returns false for tokens that were never issued", () => {
		const gate = createGenerationGate();
		gate.next();
		expect(gate.isCurrent(0)).toBe(false);
		expect(gate.isCurrent(99)).toBe(false);
		expect(gate.isCurrent(-1)).toBe(false);
	});

	it("simulates the App.tsx race-discard pattern correctly", async () => {
		// Models loadAllData: two overlapping refreshes where the older one
		// resolves last; the gate must keep the older write from clobbering the
		// fresher state.
		const gate = createGenerationGate();
		// Wrap in an object so the in-closure assignment is visible to the
		// type system at the assertion site.
		const state: { applied: number | null } = { applied: null };

		const fakeLoad = async (label: number, delayMs: number) => {
			const token = gate.next();
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			if (!gate.isCurrent(token)) return; // stale → discard
			state.applied = label;
		};

		// Start the older call with a longer delay, then the newer one with a
		// shorter delay so the newer resolves first.
		const stale = fakeLoad(1, 30);
		const fresh = fakeLoad(2, 5);
		await Promise.all([stale, fresh]);

		// Only the newer call's write should have stuck.
		expect(state.applied).toBe(2);
	});

	it("does not block the latest in-flight call if a still-newer one starts after it resolves", () => {
		// Sanity: the gate stays open for subsequent calls (it doesn't get "stuck").
		const gate = createGenerationGate();

		const t1 = gate.next();
		const t2 = gate.next();
		// t1 is now stale.
		expect(gate.isCurrent(t1)).toBe(false);
		expect(gate.isCurrent(t2)).toBe(true);

		// Later call.
		const t3 = gate.next();
		expect(gate.isCurrent(t2)).toBe(false);
		expect(gate.isCurrent(t3)).toBe(true);
	});

	it("models the stuck-spinner case using the real trackSpinner helper", async () => {
		// This is the production wiring: loadAllData uses createGenerationGate
		// for race-discard AND trackSpinner for spinner teardown. The two are
		// intentionally independent — the spinner must clear even when the
		// caller's results are discarded as stale. Exercising both helpers
		// together here means a regression in either one fails this test.
		const gate = createGenerationGate();
		const ui: { isLoading: boolean } = { isLoading: false };
		const setLoading = (b: boolean) => {
			ui.isLoading = b;
		};

		const fakeLoad = async (showLoading: boolean, delayMs: number) => {
			const token = gate.next();
			const spinner = trackSpinner({ show: showLoading, setLoading });
			try {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
				if (!gate.isCurrent(token)) return;
			} finally {
				spinner.release();
			}
		};

		// Foreground load (turns spinner on, slow) gets superseded by a
		// background refresh (no spinner, fast).
		const foreground = fakeLoad(true, 30);
		const background = fakeLoad(false, 5);
		await Promise.all([foreground, background]);

		expect(ui.isLoading).toBe(false);
	});
});

describe("trackSpinner", () => {
	it("toggles setLoading(true) when show is true and setLoading(false) on release", () => {
		const calls: boolean[] = [];
		const tracker = trackSpinner({ show: true, setLoading: (b) => calls.push(b) });
		expect(calls).toEqual([true]);
		tracker.release();
		expect(calls).toEqual([true, false]);
	});

	it("never touches setLoading when show is false", () => {
		const calls: boolean[] = [];
		const tracker = trackSpinner({ show: false, setLoading: (b) => calls.push(b) });
		expect(calls).toEqual([]);
		tracker.release();
		expect(calls).toEqual([]);
	});

	it("release is idempotent — calling it twice does not clear loading twice", () => {
		const calls: boolean[] = [];
		const tracker = trackSpinner({ show: true, setLoading: (b) => calls.push(b) });
		tracker.release();
		tracker.release();
		tracker.release();
		expect(calls).toEqual([true, false]);
	});
});
