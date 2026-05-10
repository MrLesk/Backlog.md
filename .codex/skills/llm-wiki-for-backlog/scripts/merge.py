#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UserManual Merger

Merges README.md + SUMMARY.md and all referenced pages into a single
auto-numbered markdown file, copying local assets into the output directory.

Usage:
    python merge.py <input_dir> [-o <output_path>]

Default output:
    backlog/wiki_output/用户手册/guide.md

Assets are collected and copied to:
    <output_dir>/assets/

Rules:
- README.md content goes first (headings preserved, not numbered)
- SUMMARY.md ## groups become # headings with numbers (1, 2, 3...)
- Pages are inserted where their SUMMARY link appears
- All headings in the final document are auto-numbered (1, 1.1, 1.1.1...)
- Headings are downgraded by their SUMMARY depth:
  * SUMMARY level 2 (top link): downgrade by 1
  * SUMMARY level 3 (nested once): downgrade by 2
  * SUMMARY level 4 (nested twice): downgrade by 3, etc.
- If a page lacks a # heading, a synthetic heading is inserted using the SUMMARY link title
- If a page's # heading differs from the SUMMARY link title, the SUMMARY title wins
- Local assets (images) referenced by pages are copied to output_dir/assets/
"""

import re
import shutil
import argparse
from pathlib import Path


def parse_summary(summary_path):
	"""Parse SUMMARY.md into groups and pages."""
	if not summary_path.exists():
		return []

	content = summary_path.read_text(encoding="utf-8")
	groups = []
	current_group = None

	for line in content.splitlines():
		line = line.rstrip()
		if not line:
			continue

		m = re.match(r"^##\s+(.+)$", line)
		if m:
			current_group = {"title": m.group(1).strip(), "pages": []}
			groups.append(current_group)
			continue

		m = re.match(r"^(\s*)-\s*\[([^\]]+)\]\(([^)]*)\)\s*$", line)
		if m and current_group is not None:
			path = m.group(3).strip()
			if not path:
				continue
			indent = len(m.group(1))
			offset = indent // 4 + 1
			current_group["pages"].append({
				"title": m.group(2).strip(),
				"path": path,
				"offset": offset,
			})

	return groups


def strip_frontmatter(content):
	if content.startswith("---"):
		parts = content.split("---", 2)
		if len(parts) >= 3:
			return parts[2].strip("\n")
	return content


def extract_headings_from_lines(lines):
	headings = {}
	in_code = False
	code_fence = None

	for i, line in enumerate(lines):
		stripped = line.strip()
		if stripped.startswith("```") or stripped.startswith("~~~"):
			if not in_code:
				in_code = True
				code_fence = stripped[:3]
			elif stripped.startswith(code_fence):
				in_code = False
				code_fence = None
			continue
		if in_code:
			continue
		m = re.match(r"^(#{1,6})\s+(.+)$", line)
		if m:
			headings[i] = {
				"level": len(m.group(1)),
				"title": m.group(2).strip(),
			}
	return headings


def process_assets(content, base_dir, output_assets_dir, asset_map):
	"""
	Scan content for local Markdown image references, copy assets to output dir,
	and return updated content with new paths.
	asset_map: {source_abs_path: output_relative_path}
	"""
	new_lines = []
	asset_re = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")

	for line in content.splitlines():
		matches = list(asset_re.finditer(line))
		if not matches:
			new_lines.append(line)
			continue

		new_line = line
		for m in reversed(matches):
			orig_path = m.group(2).strip()
			# Skip URLs, anchors, data URIs
			if re.match(r"^(https?://|mailto:|data:|#)", orig_path):
				continue

			abs_path = (base_dir / orig_path).resolve()
			if not abs_path.exists() or not abs_path.is_file():
				continue

			if abs_path in asset_map:
				new_rel = asset_map[abs_path]
			else:
				filename = abs_path.name
				out_path = output_assets_dir / filename

				counter = 1
				stem = abs_path.stem
				suffix = abs_path.suffix
				while out_path.exists():
					if out_path.stat().st_size == abs_path.stat().st_size:
						break
					out_path = output_assets_dir / f"{stem}_{counter}{suffix}"
					counter += 1

				if not out_path.exists():
					output_assets_dir.mkdir(parents=True, exist_ok=True)
					shutil.copy2(abs_path, out_path)

				new_rel = f"assets/{out_path.name}"
				asset_map[abs_path] = new_rel

			replacement = f"![{m.group(1)}]({new_rel})"
			new_line = new_line[:m.start()] + replacement + new_line[m.end():]

		new_lines.append(new_line)

	return "\n".join(new_lines)


def process_page(content, summary_title, offset):
	lines = content.splitlines()
	headings = extract_headings_from_lines(lines)

	first_h1_index = None
	for i in sorted(headings.keys()):
		if headings[i]["level"] == 1:
			first_h1_index = i
			break

	new_lines = []
	if first_h1_index is None:
		new_level = min(1 + offset, 6)
		new_lines.append(f'{"#" * new_level} {summary_title}')
		new_lines.append("")

	for i, line in enumerate(lines):
		if i in headings:
			h = headings[i]
			new_level = min(h["level"] + offset, 6)
			if i == first_h1_index:
				new_lines.append(f'{"#" * new_level} {summary_title}')
			else:
				new_lines.append(f'{"#" * new_level} {h["title"]}')
		else:
			new_lines.append(line)

	return new_lines


def merge_usermanual(input_dir, output_path):
	input_dir = Path(input_dir).resolve()
	output_path = Path(output_path).resolve()
	output_dir = output_path.parent
	output_assets_dir = output_dir / "assets"

	asset_map = {}
	doc = []

	# --- README ---
	readme_path = input_dir / "README.md"
	if readme_path.exists():
		content = strip_frontmatter(readme_path.read_text(encoding="utf-8"))
		content = process_assets(content, input_dir, output_assets_dir, asset_map)
		for line in content.splitlines():
			m = re.match(r"^(#{1,6})\s+(.+)$", line)
			if m:
				doc.append({
					"kind": "heading",
					"level": len(m.group(1)),
					"title": m.group(2).strip(),
					"line": line,
					"skip_number": True,
				})
			else:
				doc.append({"kind": "text", "line": line})
		doc.append({"kind": "text", "line": ""})
		doc.append({"kind": "text", "line": "---"})
		doc.append({"kind": "text", "line": ""})

	# --- SUMMARY & Pages ---
	groups = parse_summary(input_dir / "SUMMARY.md")

	for group in groups:
		doc.append({
			"kind": "heading",
			"level": 1,
			"title": group["title"],
			"line": f'# {group["title"]}',
		})
		doc.append({"kind": "text", "line": ""})

		for page in group["pages"]:
			page_path = input_dir / page["path"]
			if not page_path.exists() or not page_path.is_file():
				continue

			content = strip_frontmatter(page_path.read_text(encoding="utf-8"))
			content = process_assets(content, page_path.parent, output_assets_dir, asset_map)
			processed_lines = process_page(content, page["title"], page["offset"])

			for line in processed_lines:
				m = re.match(r"^(#{1,6})\s+(.+)$", line)
				if m:
					doc.append({
						"kind": "heading",
						"level": len(m.group(1)),
						"title": m.group(2).strip(),
						"line": line,
					})
				else:
					doc.append({"kind": "text", "line": line})

			doc.append({"kind": "text", "line": ""})

	# --- Auto-numbering ---
	heading_indices = [
		(i, item["level"], item["title"])
		for i, item in enumerate(doc)
		if item["kind"] == "heading" and not item.get("skip_number")
	]

	counters = [0] * 7
	prev_level = 0
	number_map = {}

	for idx, level, title in heading_indices:
		if level > prev_level:
			counters[level] = 1
		elif level == prev_level:
			counters[level] += 1
		else:
			counters[level] += 1
			for i in range(level + 1, 7):
				counters[i] = 0

		number = ".".join(str(counters[i]) for i in range(1, level + 1))
		number_map[idx] = number
		prev_level = level

	for i, item in enumerate(doc):
		if item["kind"] == "heading" and i in number_map:
			num = number_map[i]
			doc[i]["line"] = f'{"#" * item["level"]} {num} {item["title"]}'

	result = "\n".join(item["line"] for item in doc)
	output_path.parent.mkdir(parents=True, exist_ok=True)
	output_path.write_text(result, encoding="utf-8")
	print(f"Merged document written to: {output_path}")
	if asset_map:
		print(f"Copied {len(asset_map)} assets to: {output_assets_dir}")


def main():
	parser = argparse.ArgumentParser(
		description="Merge usermanual (README + SUMMARY + pages) into a single numbered markdown file."
	)
	parser.add_argument("input_dir", help="Directory containing README.md and SUMMARY.md")
	parser.add_argument(
		"-o",
		"--output",
		default="backlog/wiki_output/用户手册/manual.md",
		help="Output file path (default: backlog/wiki_output/用户手册/guide.md)",
	)
	args = parser.parse_args()

	merge_usermanual(args.input_dir, args.output)
	return 0


if __name__ == "__main__":
	exit(main())
