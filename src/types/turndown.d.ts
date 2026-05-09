declare module "turndown" {
	interface Rule {
		filter: string | string[] | ((node: HTMLElement) => boolean);
		replacement: (content: string, node: HTMLElement, options: TurndownOptions) => string | null | undefined;
	}

	interface TurndownOptions {
		headingStyle?: "setext" | "atx";
		hr?: "***" | "---" | "___" | string;
		bulletListMarker?: "*" | "+" | "-";
		codeBlockStyle?: "indented" | "fenced";
		fence?: "```" | "~~~" | string;
		emDelimiter?: "_" | "*";
		strongDelimiter?: "**" | "__";
		linkStyle?: "inlined" | "referenced";
		linkReferenceStyle?: "full" | "collapsed" | "shortcut";
		preformattedCode?: boolean;
	}

	export default class TurndownService {
		constructor(options?: TurndownOptions);
		addRule(key: string, rule: Rule): this;
		remove(keys: string | string[]): this;
		use(plugin: (turndownService: TurndownService) => void): this;
		escape(str: string): string;
		turndown(html: string | Node): string;
	}
}
