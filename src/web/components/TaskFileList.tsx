import { type FormEvent, useId } from "react";
import { TaskPanel } from "./TaskPageLayout";

interface TaskFileListProps {
	/** The panel's caption: "References", "Modified files" or "Documentation". */
	title: string;
	/** Paths from the project root and URLs, in the order the task lists them. */
	items: string[];
	/** What the panel says while the list is empty. */
	emptyText: string;
	/** The singular name of an entry, for the remove buttons: "reference", "modified file". */
	entryName: string;
	/** Removes the entry at an index; absent while the task cannot be changed. */
	onRemove?: (index: number) => void;
	/** Adds an entry; absent while entries cannot be added. */
	onAdd?: (value: string) => void;
	addPlaceholder?: string;
	/** A finished task can list hundreds of files, so its list scrolls inside the panel. */
	scrolls?: boolean;
}

const isUrl = (value: string) => value.startsWith("http://") || value.startsWith("https://");

/**
 * A panel beside the task's reading column that lists files and links: each row has a file or link icon and the path
 * in mono, a URL opens in a new tab, and while the task can be changed a row can be removed and a new entry added.
 */
export default function TaskFileList({
	title,
	items,
	emptyText,
	entryName,
	onRemove,
	onAdd,
	addPlaceholder,
	scrolls = false,
}: TaskFileListProps) {
	const inputId = useId();

	const addEntry = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const input = event.currentTarget.elements.namedItem("entry") as HTMLInputElement;
		const value = input.value.trim();
		// Only a new entry is a change.
		if (value && !items.includes(value)) {
			onAdd?.(value);
			input.value = "";
		}
	};

	return (
		<TaskPanel title={title} count={items.length}>
			{items.length > 0 ? (
				<ul role="list" className={`-mx-1.5 flex flex-col gap-px ${scrolls ? "max-h-64 overflow-y-auto overscroll-contain" : ""}`}>
					{items.map((item, index) => (
						<li key={`${index}-${item}`} className="group flex min-h-[30px] items-center gap-0.5 rounded-[7px] pr-0.5 pl-1.5 hover:bg-hover">
							<span className="flex min-w-0 flex-1 items-center gap-[7px] py-[5px] font-mono text-[11.5px] leading-[1.35] text-ink-2 wrap-anywhere">
								<span className="flex shrink-0 text-ink-3">{isUrl(item) ? <LinkIcon /> : <FileIcon />}</span>
								{isUrl(item) ? (
									<a href={item} target="_blank" rel="noopener noreferrer" className="min-w-0 rounded-[4px] text-accent-text hover:underline focus-ring">
										{item}
									</a>
								) : (
									<span className="min-w-0">{item}</span>
								)}
							</span>
							{onRemove && (
								<button
									type="button"
									onClick={() => onRemove(index)}
									aria-label={`Remove ${entryName} ${item}`}
									title={`Remove ${entryName}`}
									className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-surface-2 hover:text-blocked focus-visible:opacity-100 focus-ring"
								>
									<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
										<path d="m4.5 4.5 7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
									</svg>
								</button>
							)}
						</li>
					))}
				</ul>
			) : (
				<p className="text-xs text-ink-3">{emptyText}</p>
			)}
			{onAdd && (
				<form onSubmit={addEntry} className="flex gap-1.5">
					<label htmlFor={inputId} className="sr-only">
						{`Add ${entryName}`}
					</label>
					<input
						id={inputId}
						name="entry"
						type="text"
						placeholder={addPlaceholder}
						className="h-8 min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 font-mono text-xs text-ink placeholder:font-sans placeholder:text-ink-3 focus-ring"
					/>
					<button
						type="submit"
						className="h-8 shrink-0 rounded-control border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors duration-200 hover:bg-hover focus-ring"
					>
						Add
					</button>
				</form>
			)}
		</TaskPanel>
	);
}

function FileIcon() {
	return (
		<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
			<path d="M4 2.5h5l3 3v8H4z M9 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
		</svg>
	);
}

function LinkIcon() {
	return (
		<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
			<path
				d="M6.8 9.2a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.6.6M9.2 6.8a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l.6-.6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
			/>
		</svg>
	);
}
