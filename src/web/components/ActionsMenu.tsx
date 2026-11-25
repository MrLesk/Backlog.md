import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

export interface MenuAction {
	label: string;
	onSelect: () => void;
	icon?: ReactNode;
}

interface ActionsMenuProps {
	/** The name of the button, such as "Column actions" or "More actions". */
	label: string;
	actions: MenuAction[];
	/**
	 * Where the open menu sits, as classes for an absolutely placed element. The menu is placed against the nearest
	 * positioned ancestor of the button, which the caller chooses.
	 */
	menuClassName: string;
	disabled?: boolean;
}

/**
 * A button with three dots that opens a short menu of actions. A click outside closes it, Escape closes it and returns
 * focus to the button, and choosing an action closes it and returns focus to the button before the action runs, so a
 * confirmation the action asks for and the person cancels leaves focus on the button.
 */
export default function ActionsMenu({ label, actions, menuClassName, disabled = false }: ActionsMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuId = useId();

	useEffect(() => {
		if (!isOpen) return;
		const closeOnOutsideClick = (event: MouseEvent) => {
			if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
		};
		document.addEventListener("mousedown", closeOnOutsideClick);
		return () => document.removeEventListener("mousedown", closeOnOutsideClick);
	}, [isOpen]);

	// The key stops here, so whatever the menu sits in (a page that closes on Escape, say) does not see it too.
	const closeOnEscape = (event: KeyboardEvent) => {
		if (event.key !== "Escape" || !isOpen) return;
		event.preventDefault();
		event.stopPropagation();
		setIsOpen(false);
		buttonRef.current?.focus();
	};

	return (
		<div ref={wrapperRef} onKeyDown={closeOnEscape}>
			<button
				type="button"
				ref={buttonRef}
				onClick={() => setIsOpen((open) => !open)}
				disabled={disabled}
				className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-2 transition-colors duration-200 hover:bg-hover hover:text-ink focus-ring disabled:opacity-50"
				title={label}
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={isOpen}
				aria-controls={isOpen ? menuId : undefined}
			>
				<svg className="size-3.5" viewBox="0 0 16 16" aria-hidden="true">
					<path d="M3.5 8h.01M8 8h.01M12.5 8h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
				</svg>
			</button>
			{isOpen && (
				<div id={menuId} role="menu" className={`z-50 rounded-control border border-line bg-surface py-1 shadow-lg ${menuClassName}`}>
					{actions.map((action) => (
						<button
							key={action.label}
							type="button"
							role="menuitem"
							onClick={() => {
								setIsOpen(false);
								buttonRef.current?.focus();
								action.onSelect();
							}}
							className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors duration-150 hover:bg-hover focus-ring"
						>
							{action.icon}
							{action.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
