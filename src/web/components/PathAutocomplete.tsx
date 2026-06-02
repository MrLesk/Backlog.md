import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../lib/api";

interface PathAutocompleteProps {
	name?: string;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	onSubmit?: (value: string) => void;
}

interface FileEntry {
	name: string;
	fullPath: string;
	type: "file" | "directory";
}

function getDirectoryAndPrefix(input: string): { dir: string; prefix: string } {
	if (!input) return { dir: ".", prefix: "" };
	const lastSep = Math.max(input.lastIndexOf("/"), input.lastIndexOf("\\"));
	if (lastSep === -1) {
		return { dir: ".", prefix: input };
	}
	return {
		dir: input.slice(0, lastSep) || ".",
		prefix: input.slice(lastSep + 1),
	};
}

function looksLikeUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim());
}

export const PathAutocomplete = React.forwardRef<HTMLInputElement, PathAutocompleteProps>(
	({ name, placeholder, disabled, className, onSubmit }, forwardedRef) => {
		const inputRef = useRef<HTMLInputElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const [entries, setEntries] = useState<FileEntry[]>([]);
		const [highlightedIndex, setHighlightedIndex] = useState(0);
		const [isOpen, setIsOpen] = useState(false);
		const [isLoading, setIsLoading] = useState(false);
		const abortRef = useRef<AbortController | null>(null);
		const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

		React.useImperativeHandle(
			forwardedRef,
			() => inputRef.current!,
			[],
		);

		const fetchList = useCallback(async (dir: string, separator: string) => {
			if (abortRef.current) {
				abortRef.current.abort();
			}
			const controller = new AbortController();
			abortRef.current = controller;
			setIsLoading(true);
			try {
				const result = await apiClient.listFiles(dir);
				if (!controller.signal.aborted) {
					setEntries(
						result.map((r) => ({
							name: r.name,
							fullPath: dir === "." ? r.name : `${dir.replace(/[\\/]$/, "")}${separator}${r.name}`,
							type: r.type,
						})),
					);
					setHighlightedIndex(0);
				}
			} catch {
				if (!controller.signal.aborted) {
					setEntries([]);
				}
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			}
		}, []);

		const fetchSearch = useCallback(async (query: string) => {
			if (abortRef.current) {
				abortRef.current.abort();
			}
			const controller = new AbortController();
			abortRef.current = controller;
			setIsLoading(true);
			try {
				const result = await apiClient.searchFiles(query);
				if (!controller.signal.aborted) {
					setEntries(
						result.map((r) => ({
							name: r.name,
							fullPath: r.path,
							type: r.type,
						})),
					);
					setHighlightedIndex(0);
				}
			} catch {
				if (!controller.signal.aborted) {
					setEntries([]);
				}
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			}
		}, []);

		const handleInputChange = useCallback(() => {
			const value = inputRef.current?.value ?? "";
			if (looksLikeUrl(value)) {
				setIsOpen(false);
				return;
			}
			const hasSep = value.includes("/") || value.includes("\\");
			if (hasSep) {
				const { dir, prefix } = getDirectoryAndPrefix(value);
				const separator = value.includes("\\") ? "\\" : "/";
				void fetchList(dir, separator);
			} else {
				void fetchSearch(value);
			}
			setIsOpen(true);
		}, [fetchList, fetchSearch]);

		const currentValue = inputRef.current?.value ?? "";
		const hasSep = currentValue.includes("/") || currentValue.includes("\\");
		const { prefix } = getDirectoryAndPrefix(currentValue);
		const lowerPrefix = prefix.toLowerCase();

		const filtered = useMemo(() => {
			if (!hasSep) return entries;
			if (!prefix) return entries;
			return entries
				.filter((e) => e.name.toLowerCase().includes(lowerPrefix))
				.sort((a, b) => {
					const aLower = a.name.toLowerCase();
					const bLower = b.name.toLowerCase();
					const aStarts = aLower.startsWith(lowerPrefix);
					const bStarts = bLower.startsWith(lowerPrefix);
					if (aStarts && !bStarts) return -1;
					if (!aStarts && bStarts) return 1;
					return aLower.localeCompare(bLower);
				});
		}, [entries, hasSep, prefix, lowerPrefix]);

		const handleKeyDown = useCallback(
			(e: React.KeyboardEvent<HTMLInputElement>) => {
				if (e.key === "ArrowLeft") {
					e.preventDefault();
					if (!inputRef.current) return;
					const value = inputRef.current.value;
					const trimmed = value.replace(/[\\/]$/, "");
					const lastSep = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
					if (lastSep === -1) {
						inputRef.current.value = "";
					} else {
						inputRef.current.value = trimmed.slice(0, lastSep + 1);
					}
					handleInputChange();
					return;
				}

				if (e.key === "ArrowRight") {
					e.preventDefault();
					if (!isOpen || filtered.length === 0) return;
					const entry = filtered[highlightedIndex];
					if (!entry || entry.type !== "directory" || !inputRef.current) return;
					const sep = entry.fullPath.includes("\\") ? "\\" : "/";
					inputRef.current.value = entry.fullPath + sep;
					handleInputChange();
					return;
				}

				if (!isOpen || filtered.length === 0) return;

				if (e.key === "ArrowDown") {
					e.preventDefault();
					setHighlightedIndex((prev) => (prev + 1) % filtered.length);
				} else if (e.key === "ArrowUp") {
					e.preventDefault();
					setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
				} else if (e.key === "Enter") {
					e.preventDefault();
					const entry = filtered[highlightedIndex];
					if (entry && inputRef.current) {
						const suffix = entry.type === "directory" ? "/" : "";
						inputRef.current.value = entry.fullPath + suffix;
						setIsOpen(false);
						// If directory, reopen dropdown after a tick so user can continue navigating
						if (entry.type === "directory") {
							setTimeout(() => {
								setIsOpen(true);
								const sep = entry.fullPath.includes("\\") ? "\\" : "/";
								void fetchList(entry.fullPath + suffix, sep);
							}, 0);
						}
					}
				} else if (e.key === "Escape") {
					setIsOpen(false);
				}
			},
			[isOpen, filtered, highlightedIndex, handleInputChange],
		);

		const handleSelect = useCallback(
			(entry: FileEntry) => {
				if (!inputRef.current) return;
				const suffix = entry.type === "directory" ? "/" : "";
				inputRef.current.value = entry.fullPath + suffix;
				setIsOpen(false);
				inputRef.current.focus();
				// If directory, reopen dropdown after a tick so user can continue navigating
				if (entry.type === "directory") {
					setTimeout(() => {
						setIsOpen(true);
						const sep = entry.fullPath.includes("\\") ? "\\" : "/";
						void fetchList(entry.fullPath + suffix, sep);
					}, 0);
				}
			},
			[fetchList],
		);

		useEffect(() => {
			const onClick = (e: MouseEvent) => {
				if (!containerRef.current?.contains(e.target as Node)) {
					setIsOpen(false);
				}
			};
			document.addEventListener("mousedown", onClick);
			return () => document.removeEventListener("mousedown", onClick);
		}, []);

		useEffect(() => {
			const el = itemRefs.current[highlightedIndex];
			if (el) {
				el.scrollIntoView({ block: "nearest" });
			}
		}, [highlightedIndex]);

		return (
			<div ref={containerRef} className="relative flex-1">
				<input
					ref={inputRef}
					name={name}
					type="text"
					placeholder={placeholder}
					disabled={disabled}
					className={`${className} w-full`}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					onFocus={handleInputChange}
				/>
				{isOpen && filtered.length > 0 && (
					<ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
						{filtered.map((entry, idx) => (
							<li
								key={entry.fullPath}
								ref={(el) => { itemRefs.current[idx] = el; }}
								className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
									idx === highlightedIndex
										? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
										: "text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
								}`}
								onMouseEnter={() => setHighlightedIndex(idx)}
								onClick={() => handleSelect(entry)}
							>
								<span className="text-gray-400 dark:text-gray-500">
									{entry.type === "directory" ? "📁" : "📄"}
								</span>
								<span className="truncate">{entry.name}</span>
							</li>
						))}
					</ul>
				)}
				{isOpen && isLoading && filtered.length === 0 && (
					<div className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
						Loading...
					</div>
				)}
			</div>
		);
	},
);

PathAutocomplete.displayName = "PathAutocomplete";
