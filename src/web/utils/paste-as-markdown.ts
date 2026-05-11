import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndownService = new TurndownService({
	headingStyle: "atx",
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
	strongDelimiter: "**",
	emDelimiter: "*",
	fence: "```",
});

// Enable GFM extensions (tables, strikethrough, task lists)
turndownService.use(gfm);

// Remove Word-specific noise tags
turndownService.remove(["style", "meta", "link", "script"]);

// Keep <br> as raw HTML so it works inside Markdown table cells.
// Turndown's default turns <br> into "  \n" which breaks table rows.
turndownService.addRule("keepBr", {
	filter: "br",
	replacement: () => "<br>",
});

/**
 * Clean and normalise HTML (especially from Word / docx sources) so that
 * Turndown produces clean Markdown.
 *
 * Handles:
 * - Word mso-list paragraphs → <ul><li>
 * - Inline style → semantic tag conversion (bold, italic, underline)
 * - Table cell flattening (unwraps <p>, <div> inside <td>/<th>)
 * - First table row promoted to <th> for GFM table support
 * - Removal of noise tags, classes, and empty elements
 */
export async function cleanHtml(html: string, options?: { keepMedia?: boolean }): Promise<string> {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Remove noise tags
	for (const tag of ["style", "meta", "link", "script", "colgroup", "col"]) {
		for (const el of Array.from(doc.querySelectorAll(tag))) {
			el.remove();
		}
	}

	// Word encodes bullet lists as <p style="mso-list:..."> with a conditional
	// comment wrapper. Process these before wiping inline styles.
	const msoListParas = Array.from(
		doc.querySelectorAll('p[style*="mso-list"], div[style*="mso-list"]'),
	) as HTMLElement[];
	if (msoListParas.length > 0) {
		const clusters: HTMLElement[][] = [];
		let current: HTMLElement[] = [];
		for (const el of msoListParas) {
			if (current.length === 0) {
				current.push(el);
			} else {
				const last = current[current.length - 1]!;
				let next = last.nextSibling;
				let adjacent = false;
				while (next) {
					if (next.nodeType === Node.ELEMENT_NODE) {
						adjacent = next === el;
						break;
					}
					if (next.nodeType === Node.TEXT_NODE && next.textContent?.trim()) {
						break;
					}
					next = next.nextSibling;
				}
				if (adjacent) {
					current.push(el);
				} else {
					clusters.push(current);
					current = [el];
				}
			}
		}
		if (current.length > 0) clusters.push(current);

		for (const cluster of clusters) {
			const ul = doc.createElement("ul");
			const first = cluster[0]!;
			for (const el of cluster) {
				for (const ignore of Array.from(el.querySelectorAll('[style*="mso-list:Ignore"]'))) {
					ignore.remove();
				}
				for (const child of Array.from(el.querySelectorAll("o\\:p, o\\:P"))) {
					child.remove();
				}
				const li = doc.createElement("li");
				while (el.firstChild) {
					li.appendChild(el.firstChild);
				}
				ul.appendChild(li);
				if (el !== first) {
					el.remove();
				}
			}
			if (first.parentNode) {
				first.parentNode.insertBefore(ul, first);
				first.remove();
			}
		}
	}

	// Remove mso- classes and all other classes (Markdown doesn't need them)
	for (const el of Array.from(doc.querySelectorAll("[class]"))) {
		el.removeAttribute("class");
	}

	// Convert inline styles that carry semantic meaning to actual tags
	for (const el of Array.from(doc.querySelectorAll("[style]"))) {
		const raw = el.getAttribute("style") || "";
		const rules = new Map<string, string>();
		for (const part of raw.split(";")) {
			const idx = part.indexOf(":");
			if (idx > 0) {
				rules.set(
					part.slice(0, idx).trim().toLowerCase(),
					part
						.slice(idx + 1)
						.trim()
						.toLowerCase(),
				);
			}
		}

		const alreadyWrapped = (tag: string): boolean => {
			return el.tagName === tag || el.closest(tag) !== null || el.querySelector(tag) !== null;
		};

		const fw = rules.get("font-weight");
		if (
			(fw === "bold" || fw === "700" || fw === "800" || fw === "900") &&
			!alreadyWrapped("strong") &&
			!alreadyWrapped("b")
		) {
			const wrap = doc.createElement("strong");
			while (el.firstChild) wrap.appendChild(el.firstChild);
			el.appendChild(wrap);
		}

		const fs = rules.get("font-style");
		if (fs === "italic" && !alreadyWrapped("em") && !alreadyWrapped("i")) {
			const wrap = doc.createElement("em");
			while (el.firstChild) wrap.appendChild(el.firstChild);
			el.appendChild(wrap);
		}

		const td = rules.get("text-decoration");
		if (td?.includes("underline") && !alreadyWrapped("u")) {
			const wrap = doc.createElement("u");
			while (el.firstChild) wrap.appendChild(el.firstChild);
			el.appendChild(wrap);
		}
		if (td?.includes("line-through") && !alreadyWrapped("s") && !alreadyWrapped("del") && !alreadyWrapped("strike")) {
			const wrap = doc.createElement("s");
			while (el.firstChild) wrap.appendChild(el.firstChild);
			el.appendChild(wrap);
		}

		el.removeAttribute("style");
	}

	// Drop Word-specific XML tags like <o:p>
	for (const el of Array.from(doc.querySelectorAll("o\\:p, o\\:P"))) {
		el.remove();
	}

	// Remove empty block/inline elements that Word loves to generate.
	// In docx-upload mode (keepMedia=true) we preserve elements that contain
	// media so server-side extracted images aren't stripped.
	for (const selector of ["p", "span", "font", "div"]) {
		for (const el of Array.from(doc.querySelectorAll(selector))) {
			const hasMedia = !!el.querySelector("img, video, audio, iframe, canvas, svg");
			if (!el.textContent?.trim() && !(options?.keepMedia && hasMedia)) {
				el.remove();
			}
		}
	}

	// Plain paragraphs that start with a Unicode bullet char (not mso-list)
	// also need conversion so Turndown produces "- item" syntax.
	const BULLET_RE =
		/^[\s\u2022\u25cf\u00b7\u25cb\u25e6\u2219\u2023\uf06c\uf0b7\uf0a7\u25aa\u25ab\u2013\u2014\u2794\u27a2]+/;
	const bulletCandidates = Array.from(doc.querySelectorAll("p, div")).filter(
		(el) => !el.closest("ul, ol, table") && BULLET_RE.test(el.textContent || ""),
	) as HTMLElement[];

	if (bulletCandidates.length > 0) {
		const clusters: HTMLElement[][] = [];
		let current: HTMLElement[] = [];
		for (const el of bulletCandidates) {
			if (current.length === 0) {
				current.push(el);
			} else {
				const last = current[current.length - 1]!;
				let next = last.nextSibling;
				let adjacent = false;
				while (next) {
					if (next.nodeType === Node.ELEMENT_NODE) {
						adjacent = next === el;
						break;
					}
					if (next.nodeType === Node.TEXT_NODE && next.textContent?.trim()) {
						break;
					}
					next = next.nextSibling;
				}
				if (adjacent) {
					current.push(el);
				} else {
					clusters.push(current);
					current = [el];
				}
			}
		}
		if (current.length > 0) clusters.push(current);

		for (const cluster of clusters) {
			const ul = doc.createElement("ul");
			for (const el of cluster) {
				const li = doc.createElement("li");
				let text = el.textContent || "";
				text = text.replace(BULLET_RE, "").trim();
				if (text) {
					li.textContent = text;
				}
				ul.appendChild(li);
				el.remove();
			}
			const first = cluster[0]!;
			if (first.parentNode) {
				first.parentNode.insertBefore(ul, first);
			}
		}
	}

	// Normalise tables for Markdown conversion:
	// 1. Recursively unwrap any block-level elements inside cells.
	//    Word loves wrapping cell content in <p>, <div>, <section>, etc.
	//    Turndown treats those as block paragraphs (\n\n) which breaks
	//    Markdown table syntax — every cell must stay on a single line.
	// 2. Collapse whitespace inside every cell.
	// 3. Ensure the first row uses <th> so turndown-plugin-gfm recognises
	//    the table heading.
	const inlineTags = new Set([
		"A",
		"ABBR",
		"B",
		"BDI",
		"BDO",
		"BR",
		"CITE",
		"CODE",
		"DATA",
		"DEL",
		"DFN",
		"EM",
		"I",
		"INS",
		"KBD",
		"MARK",
		"Q",
		"RUBY",
		"S",
		"SAMP",
		"SMALL",
		"SPAN",
		"STRIKE",
		"STRONG",
		"SUB",
		"SUP",
		"TIME",
		"U",
		"VAR",
		"WBR",
	]);

	for (const table of Array.from(doc.querySelectorAll("table"))) {
		for (const cell of Array.from(table.querySelectorAll("td, th"))) {
			// Flatten lists inside table cells into prefixed paragraphs.
			for (const list of Array.from(cell.querySelectorAll("ul, ol"))) {
				const isOrdered = list.tagName === "OL";
				let index = 1;
				const fragment = doc.createDocumentFragment();
				for (const item of Array.from(list.querySelectorAll("li"))) {
					for (const p of Array.from(item.querySelectorAll("p"))) {
						const pFrag = doc.createDocumentFragment();
						while (p.firstChild) pFrag.appendChild(p.firstChild);
						p.replaceWith(pFrag);
					}
					const p = doc.createElement("p");
					const prefix = isOrdered ? `${index}. ` : "";
					p.innerHTML = prefix + item.innerHTML.trim();
					fragment.appendChild(p);
					index++;
				}
				list.replaceWith(fragment);
			}

			// Recursively unwrap non-inline elements until only inline
			// tags and text nodes remain.
			let changed = true;
			while (changed) {
				changed = false;
				for (const el of Array.from(cell.querySelectorAll("*"))) {
					if (!inlineTags.has(el.tagName)) {
						const fragment = doc.createDocumentFragment();
						while (el.firstChild) {
							fragment.appendChild(el.firstChild);
						}
						if (el.tagName === "P") {
							fragment.appendChild(doc.createElement("br"));
						}
						el.replaceWith(fragment);
						changed = true;
						break;
					}
				}
			}
			let html = cell.innerHTML;
			html = html.trim().replace(/\s+/g, " ");
			html = html.replace(/(\s*<br>)+\s*$/i, "");
			cell.innerHTML = html;
		}

		const firstRow = table.querySelector("tr");
		if (firstRow) {
			for (const td of Array.from(firstRow.querySelectorAll("td"))) {
				const th = doc.createElement("th");
				th.innerHTML = td.innerHTML;
				for (const attr of Array.from(td.attributes)) {
					th.setAttribute(attr.name, attr.value);
				}
				td.replaceWith(th);
			}
		}
	}

	return doc.body.innerHTML.trim();
}

/**
 * Convert rich-text HTML on the clipboard to Markdown.
 *
 * @returns the Markdown string when conversion succeeded and differs from
 *          plain text; `null` when there is no rich-text benefit.
 */
export type ImageUploader = (source: Blob | string) => Promise<string | null>;

export async function handlePasteAsMarkdown(
	e: React.ClipboardEvent<HTMLTextAreaElement>,
	uploadImage?: ImageUploader,
): Promise<string | null> {
	const html = e.clipboardData.getData("text/html");
	const plainText = e.clipboardData.getData("text/plain");

	// No HTML on the clipboard → no rich-text benefit.
	if (!html || html.trim().length === 0) {
		return null;
	}

	const cleanedHtml = await cleanHtml(html);
	if (!cleanedHtml || cleanedHtml.trim().length === 0) {
		return null;
	}

	let processedHtml = cleanedHtml;

	// Process images in the HTML before converting to Markdown.
	if (uploadImage) {
		const parser = new DOMParser();
		const doc = parser.parseFromString(cleanedHtml, "text/html");
		const images = Array.from(doc.querySelectorAll("img"));
		if (images.length > 0) {
			await Promise.all(
				images.map(async (img) => {
					const src = img.getAttribute("src") || "";
					if (!src) {
						img.remove();
						return;
					}
					// Reject file:// and relative paths that aren't data URIs or HTTP(S)
					if (!src.startsWith("data:") && !src.startsWith("http://") && !src.startsWith("https://")) {
						img.remove();
						return;
					}
					try {
						const newUrl = await uploadImage(src);
						if (newUrl) {
							img.setAttribute("src", newUrl);
						} else {
							img.remove();
						}
					} catch {
						img.remove();
					}
				}),
			);
			processedHtml = doc.body.innerHTML.trim();
		}
	}

	let markdown: string;
	try {
		markdown = turndownService.turndown(processedHtml);
	} catch {
		return null;
	}

	// Move whitespace that sits *inside* bold/italic markers to the
	// outside so the markers hug the actual text.
	// "**  text **"  → " **text** "
	// "**text **"    → "**text** "
	// "** text**"    → " **text**"
	let prev: string;
	do {
		prev = markdown;
		markdown = markdown.replace(/\*\*(\s*)([^\n]*?)(\s*)\*\*/g, "$1**$2**$3");
	} while (markdown !== prev);

	// Same for italic (single asterisk) — be careful not to touch list bullets.
	// We only match when both opening and closing * are present around content.
	do {
		prev = markdown;
		markdown = markdown.replace(/(?<!\*)\*(\s*)([^\s*][^\n]*?[^\s*])(\s*)\*(?!\*)/g, "$1*$2*$3");
	} while (markdown !== prev);

	// Ensure a space after bold/italic closers when they touch plain text.
	// "**text**word" → "**text** word"
	// "*text*word"   → "*text* word"
	markdown = markdown.replace(/\*\*([^\s][^\n]*?)\*\*([^\s*<|\n\r])/g, "**$1** $2");
	markdown = markdown.replace(/(?<!\*)\*([^\s*][^\n]*?)\*([^\s*<|\n\r])(?!\*)/g, "*$1* $2");

	// Ensure ordered-list markers are followed by a space so parsers recognise
	// them correctly (e.g. Word sometimes produces "1.•item").
	markdown = markdown.replace(/(^|\s)(\d+\.)([^\s\d])/g, "$1$2 $3");

	// If the converted Markdown is structurally identical to the plain-text
	// version there is no rich-text benefit; fall back to the native paste.
	const normalizedMd = markdown.trim().replace(/\s+/g, " ");
	const normalizedPlain = plainText.trim().replace(/\s+/g, " ");
	if (normalizedMd === normalizedPlain) {
		return null;
	}

	return markdown;
}
