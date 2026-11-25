import React, { useEffect, useRef } from "react";

// The open list handles the first Escape before a dialog or edit session closes.
export function isExpandedCombobox(target: EventTarget | null): boolean {
	return (target as Element | null)?.matches?.('[role="combobox"][aria-expanded="true"]') ?? false;
}

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	maxWidthClass?: string; // e.g., "max-w-4xl"
	disableEscapeClose?: boolean; // when true, Escape and backdrop click won't close (child can handle it)
	actions?: React.ReactNode; // optional actions rendered in header before close
	headerNotice?: React.ReactNode;
	initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const Modal: React.FC<ModalProps> = ({
	isOpen,
	onClose,
	title,
	children,
	maxWidthClass = "max-w-2xl",
	disableEscapeClose,
	actions,
	headerNotice,
	initialFocusRef,
}) => {
	const dialogRef = useRef<HTMLDivElement | null>(null);
	const onCloseRef = useRef(onClose);
	const disableEscapeCloseRef = useRef(disableEscapeClose);
	const initialFocusRefRef = useRef(initialFocusRef);
	onCloseRef.current = onClose;
	disableEscapeCloseRef.current = disableEscapeClose;
	initialFocusRefRef.current = initialFocusRef;

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}

		const ownerDocument = dialog.ownerDocument;
		const activeElement = ownerDocument.activeElement;
		const previouslyFocused = activeElement && "focus" in activeElement ? (activeElement as HTMLElement) : null;
		const previousOverflow = ownerDocument.body.style.overflow;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				if (isExpandedCombobox(event.target)) return;
				event.preventDefault();
				event.stopPropagation();
				if (!disableEscapeCloseRef.current) {
					onCloseRef.current();
				}
				return;
			}

			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				event.stopPropagation();
				if (!dialog.contains(ownerDocument.activeElement)) {
					dialog.focus();
				}
				return;
			}

			if (event.key !== "Tab") {
				return;
			}

			const focusable = Array.from(
				dialog.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
				),
			);
			const first = focusable[0];
			const last = focusable.at(-1);
			if (!first || !last) {
				event.preventDefault();
				dialog.focus();
				return;
			}
			if (!dialog.contains(ownerDocument.activeElement)) {
				event.preventDefault();
				event.stopPropagation();
				(event.shiftKey ? last : first).focus();
			} else if (event.shiftKey && (ownerDocument.activeElement === first || ownerDocument.activeElement === dialog)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && ownerDocument.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		ownerDocument.addEventListener("keydown", handleKeyDown, true);
		ownerDocument.body.style.overflow = "hidden";
		(initialFocusRefRef.current?.current ?? dialog).focus();

		return () => {
			ownerDocument.removeEventListener("keydown", handleKeyDown, true);
			ownerDocument.body.style.overflow = previousOverflow;
			if (previouslyFocused?.isConnected) {
				previouslyFocused.focus();
			}
		};
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4"
			onClick={disableEscapeClose ? undefined : onClose}
			role="presentation"
		>
			<div
				ref={dialogRef}
				className={`bg-surface text-ink rounded-panel border border-line shadow-2xl ${maxWidthClass} w-full max-h-[96dvh] overflow-y-auto overscroll-contain outline-none sm:max-h-[94vh] transition-colors duration-200`}
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				tabIndex={-1}
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<div className="sticky top-0 z-10 flex flex-wrap items-start gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:pt-4 border-b border-line-soft bg-surface">
					<h2 id="modal-title" className={`min-w-0 flex-1 wrap-anywhere text-base font-semibold text-ink ${actions ? "basis-full sm:basis-auto" : ""}`}>
						{title}
					</h2>
					<div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
						{actions}
						<button
							type="button"
							onClick={onClose}
							disabled={disableEscapeClose}
							className="text-ink-2 hover:text-ink hover:bg-hover rounded-control p-1 transition-colors duration-200 text-2xl leading-none size-11 sm:size-8 flex items-center justify-center focus-ring disabled:cursor-not-allowed disabled:opacity-50"
							aria-label="Close modal"
						>
							×
						</button>
					</div>
					{headerNotice && <div className="w-full">{headerNotice}</div>}
				</div>
				<div className="px-4 pt-3 pb-4 sm:px-6 sm:pt-4 sm:pb-6">{children}</div>
			</div>
		</div>
	);
};

export default Modal;
