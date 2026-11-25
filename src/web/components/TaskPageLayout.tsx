import { type KeyboardEventHandler, type ReactNode, useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { useAddressBarLocation } from "../contexts/AddressBarLocationContext.tsx";
import { pageLabelOf } from "../lib/app-pages.ts";
import { pageBeneath } from "../lib/task-links.ts";

interface TaskPageLayoutProps {
	taskId: string;
	/** What screen readers call the page: the ID and the title once the task is read. */
	label?: string;
	/** Closes the task: the close button, and Escape when nothing inside the page used it first. */
	onClose: () => void;
	/** While true, the page cannot be closed (a demotion is running). */
	closeDisabled?: boolean;
	/** The controls before the close button: Edit and More actions, or Cancel and Save. */
	actions?: ReactNode;
	/** Messages above the title, such as the read-only note. */
	notices?: ReactNode;
	/** The title, or the field that edits it. */
	heading?: ReactNode;
	/**
	 * The sections, in the reading column. Without them the task is still being read: the page draws only its head and
	 * is marked busy, and the notices, the heading and the side column wait for the sections.
	 */
	main?: ReactNode;
	/** The properties and the file panels, beside the reading column. */
	side?: ReactNode;
	/** Runs before any control inside the page sees a key, for the keyboard shortcuts of the task. */
	onKeyDownCapture?: KeyboardEventHandler;
}

/**
 * The page a task opens as, over the page it was opened from: a head row with the breadcrumb, the actions and the close
 * button, which stays in place while the body below it scrolls; then the title and the sections in a reading column
 * beside the properties. It holds no task data: TaskDetails fills it, and App draws it with only its head while the task's
 * first read is pending.
 */
export default function TaskPageLayout({
	taskId,
	label,
	onClose,
	closeDisabled = false,
	actions,
	notices,
	heading,
	main,
	side,
	onKeyDownCapture,
}: TaskPageLayoutProps) {
	const pageRef = useRef<HTMLElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);

	// A task that opens, here or in place of another one, starts at its top with keyboard focus on the page. Focus goes
	// back to what opened the task when the page closes: TaskPageLayer in Layout.tsx does that.
	useEffect(() => {
		pageRef.current?.focus({ preventScroll: true });
		if (bodyRef.current) bodyRef.current.scrollTop = 0;
	}, [taskId]);

	// The page's keys (E, Escape, Cmd/Ctrl+S) reach it only while focus is inside it. When a control of the page that had
	// focus is removed (Save and Cancel replace the fields and buttons, a menu or a list of suggestions closes), the
	// browser drops focus to the document body; whenever the page's content changes, that focus comes back to the page.
	// Focus the person moved out of the page, with a click on the sidebar's empty space say, stays where they put it.
	useEffect(() => {
		const page = pageRef.current;
		if (!page) return;
		let lastFocusedInPage: Element | null = null;
		const rememberFocus = (event: FocusEvent) => {
			lastFocusedInPage = event.target as Element;
		};
		const observer = new window.MutationObserver(() => {
			const focusDropped = !document.activeElement || document.activeElement === document.body;
			if (focusDropped && lastFocusedInPage && !lastFocusedInPage.isConnected) {
				lastFocusedInPage = null;
				page.focus({ preventScroll: true });
			}
		});
		page.addEventListener("focusin", rememberFocus);
		observer.observe(page, { childList: true, subtree: true });
		return () => {
			page.removeEventListener("focusin", rememberFocus);
			observer.disconnect();
		};
	}, []);

	return (
		<article
			ref={pageRef}
			tabIndex={-1}
			aria-label={label ?? taskId}
			aria-busy={main === undefined}
			onKeyDownCapture={onKeyDownCapture}
			onKeyDown={(event) => {
				// Escape closes the page only when no control inside it handled the key: a control that uses Escape, such as
				// an open menu or list of suggestions, calls preventDefault on it.
				if (event.key !== "Escape" || event.defaultPrevented || closeDisabled) return;
				event.preventDefault();
				event.stopPropagation();
				onClose();
			}}
			className="flex h-full flex-col outline-none"
		>
			<div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft panel-gutter py-2">
				<TaskBreadcrumb taskId={taskId} />
				<div className="ml-auto flex shrink-0 items-center gap-1.5">
					{actions}
					<button
						type="button"
						onClick={onClose}
						disabled={closeDisabled}
						aria-label="Close task"
						title="Close task"
						className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-2 transition-colors duration-200 hover:bg-hover hover:text-ink focus-ring disabled:opacity-50"
					>
						<svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
							<path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						</svg>
					</button>
				</div>
			</div>
			<div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto panel-gutter pt-6 pb-10">
				{main !== undefined && (
					<TaskColumns
						main={
							<>
								{notices}
								{heading}
								{main}
							</>
						}
						side={side}
					/>
				)}
			</div>
		</article>
	);
}

/** The way back to the page beneath the task, by its name, followed by the open task's ID. */
function TaskBreadcrumb({ taskId }: { taskId: string }) {
	const page = pageBeneath(useAddressBarLocation());

	return (
		<nav aria-label="Breadcrumb" className="min-w-0">
			<ol className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink-2">
				<li>
					<Link
						to={`${page.pathname}${page.search}`}
						className="rounded-[4px] transition-colors duration-200 hover:text-ink focus-ring"
					>
						{pageLabelOf(page.pathname) ?? "Back"}
					</Link>
				</li>
				<li aria-hidden="true" className="flex text-ink-3">
					<svg viewBox="0 0 16 16" className="size-3.5">
						<path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</li>
				<li aria-current="page" className="min-w-0 font-mono text-xs font-medium text-ink wrap-anywhere">
					{taskId}
				</li>
			</ol>
		</nav>
	);
}

/**
 * The reading column and the properties beside it, from a width of 36rem (576px); below that the properties follow the
 * sections. That keeps two columns in the content panel of a 1024px window with the sidebar open. The properties take
 * 260 to 340px, room for a status, a date and a label beside their names, and the reading column up to 780px. The task page and the dialog that creates a task both lay out a task
 * this way, and the reading column's width is set here and only here.
 */
export function TaskColumns({ main, side }: { main: ReactNode; side: ReactNode }) {
	return (
		<div className="@container">
			<div className="flex flex-col gap-8 @xl:flex-row @xl:items-start">
				<div className="flex min-w-0 flex-col gap-[22px] @xl:max-w-[780px] @xl:flex-[999_1_480px]">{main}</div>
				<aside
					aria-label="Task properties"
					className="flex min-w-0 flex-col gap-3 @xl:min-w-[260px] @xl:max-w-[340px] @xl:flex-[1_1_280px]"
				>
					{side}
				</aside>
			</div>
		</div>
	);
}

/** A section of the reading column: a caption, an optional detail beside it, and the content. */
export function TaskSection({ title, detail, children }: { title: string; detail?: ReactNode; children: ReactNode }) {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2">
			<div className="flex min-h-5 items-center gap-2">
				<h3 id={headingId} className="section-caption">
					{title}
				</h3>
				{detail}
			</div>
			{children}
		</section>
	);
}

/** A panel of the side column: Properties, or a list of files. */
export function TaskPanel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2.5 rounded-[10px] border border-line px-4 py-3.5">
			<h3 id={headingId} className="section-caption flex items-center gap-2">
				{title}
				{count !== undefined && count > 0 && <span className="tracking-normal">{count}</span>}
			</h3>
			{children}
		</section>
	);
}
