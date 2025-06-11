// Minimal declaration to satisfy TypeScript when importing "bblessed".
// The actual library is dynamically imported at runtime. We only need the
// "any" type shape to avoid compile-time errors when the package is not
// present during type checking.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module "blessed" {
	// We intentionally use the most permissive type to keep the shim minimal.
	// Downstream code performs runtime feature detection and falls back to a
	// non-TUI implementation when the real library cannot be resolved.
	// biome-ignore lint/suspicious/noExplicitAny: blessed types are complex
	const blessed: any;
	export = blessed;
}
