// Ambient declarations for files imported as text via `with { type: "text" }`
// (Bun inlines the file contents as a string at build time). Used by the
// agent-loop templates that bundle the dispatch scripts and MCP configs.
declare module "*.ps1" {
	const content: string;
	export default content;
}

declare module "*.sh" {
	const content: string;
	export default content;
}
