import React, { useEffect, useRef } from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	maxWidthClass?: string; // e.g., "max-w-4xl"
	disableEscapeClose?: boolean; // when true, Escape and backdrop click won't close (child can handle it)
	actions?: React.ReactNode; // optional actions rendered in header before close
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
			className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4"
			onClick={disableEscapeClose ? undefined : onClose}
			role="presentation"
		>
			<div
				ref={dialogRef}
				className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl ${maxWidthClass} w-full max-h-[94vh] overflow-y-auto transition-colors duration-200`}
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				tabIndex={-1}
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:dark:bg-gray-800/75">
					<h2 id="modal-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
						{title}
					</h2>
					<div className="flex items-center gap-2">
						{actions}
						<button
							type="button"
							onClick={onClose}
							disabled={disableEscapeClose}
							className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors duration-200 text-2xl leading-none w-8 h-8 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
							aria-label="Close modal"
						>
							×
						</button>
					</div>
				</div>
				<div className="px-6 pt-4 pb-6">{children}</div>
			</div>
		</div>
	);
};

export default Modal;
