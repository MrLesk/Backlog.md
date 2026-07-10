import React, { useEffect, useRef } from 'react';

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	maxWidthClass?: string; // e.g., "max-w-4xl"
	disableEscapeClose?: boolean; // when true, Escape and backdrop click won't close (child can handle it)
	actions?: React.ReactNode; // optional actions rendered in header before close
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidthClass = "max-w-2xl", disableEscapeClose, actions }) => {
	const dialogRef = useRef<HTMLDivElement | null>(null);
	const onCloseRef = useRef(onClose);

	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const activeElement = document.activeElement;
		const previouslyFocused = activeElement && "focus" in activeElement ? (activeElement as HTMLElement) : null;
		const previousOverflow = document.body.style.overflow;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !disableEscapeClose) {
				e.preventDefault();
				onCloseRef.current();
				return;
			}

			if (e.key !== 'Tab') {
				return;
			}

			const dialog = dialogRef.current;
			if (!dialog) {
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
				e.preventDefault();
				dialog.focus();
				return;
			}
			if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		document.body.style.overflow = 'hidden';
		dialogRef.current?.focus();

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.body.style.overflow = previousOverflow;
			if (previouslyFocused?.isConnected) {
				previouslyFocused.focus();
			}
		};
	}, [isOpen, disableEscapeClose]);

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
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				tabIndex={-1}
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:dark:bg-gray-800/75">
					<h2 id="modal-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
					<div className="flex items-center gap-2">
						{actions}
							<button
								onClick={onClose}
								className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors duration-200 text-2xl leading-none w-8 h-8 flex items-center justify-center"
								aria-label="Close modal"
							>
								×
							</button>
					</div>
				</div>
				<div className="px-6 pt-4 pb-6">
					{children}
				</div>
			</div>
		</div>
	);
};

export default Modal;
