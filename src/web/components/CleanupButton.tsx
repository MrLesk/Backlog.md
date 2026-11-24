interface CleanupButtonProps {
	onClick: () => void;
}

/** The button on the final status of the list and the board that opens the cleanup dialog. */
export default function CleanupButton({ onClick }: CleanupButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Clean up old tasks"
			title="Clean up old tasks"
			className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] text-ink-2 transition-colors duration-200 hover:bg-hover hover:text-ink focus-ring"
		>
			<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
				<path
					d="M3.5 3h9a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM3.5 6v6.5h9V6M6.5 9h3"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	);
}
