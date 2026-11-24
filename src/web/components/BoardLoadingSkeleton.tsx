interface BoardLoadingSkeletonProps {
	/** Ghost columns to render; pass the configured status count so the real board mounts without a width jump. */
	columnCount?: number;
}

/**
 * First-load placeholder for the board. Renders ghost columns with the
 * same chrome and geometry as the real board so content replaces it in place,
 * plus a compact centered spinner. The header's branch-indexing chip shows any
 * progress message. Shown only before the first successful data load (see BACK-654).
 */
export function BoardLoadingSkeleton({ columnCount }: BoardLoadingSkeletonProps) {
	const columns = columnCount && columnCount > 0 ? columnCount : 3;
	return (
		<div className="relative" role="status" aria-label="Loading tasks">
			<div className="overflow-x-auto pb-2" aria-hidden="true">
				<div className="flex w-full flex-row flex-nowrap">
					{Array.from({ length: columns }, (_, column) => (
						<div key={column} className="min-w-[16rem] flex-1 border-l border-line-soft px-2.5 first:border-l-0">
							{/* min-h-24 is the floor every real column has (TaskColumn), so the board
							    only ever grows from here - it never contracts, even on empty projects. */}
							<div className="min-h-24 pt-3">
								<div className="mb-4 h-4 w-24 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
								<div className="h-16 animate-pulse rounded-[10px] border border-line bg-surface motion-reduce:animate-none" />
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				<span
					className="h-5 w-5 animate-spin rounded-circle border-2 border-line border-t-accent-strong motion-reduce:animate-none"
					aria-hidden="true"
				/>
				<span className="sr-only">Loading tasks</span>
			</div>
		</div>
	);
}
