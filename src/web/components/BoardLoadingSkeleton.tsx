interface BoardLoadingSkeletonProps {
	message?: string | null;
	/** Ghost columns to render; pass the configured status count so the real board mounts without a width jump. */
	columnCount?: number;
}

/**
 * First-load placeholder for the kanban board. Renders ghost columns with the
 * same chrome and geometry as the real board so content replaces it in place,
 * plus a compact centered spinner matching the branch-indexing chip design.
 * Shown only before the first successful data load (see BACK-654).
 */
export function BoardLoadingSkeleton({ message, columnCount }: BoardLoadingSkeletonProps) {
	const columns = columnCount && columnCount > 0 ? columnCount : 3;
	return (
		<div className="relative" role="status" aria-label="Loading tasks">
			<div className="overflow-x-auto pb-2" aria-hidden="true">
				<div className="flex flex-row flex-nowrap gap-4 w-full">
					{Array.from({ length: columns }, (_, column) => (
						<div key={column} className="flex-1 min-w-[16rem]">
							{/* min-h-24 is the floor every real column has (TaskColumn), so the board
							    only ever grows from here - it never contracts, even on empty projects. */}
							<div className="rounded-lg p-4 min-h-24 bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 transition-colors duration-200">
								<div className="mb-3 h-4 w-24 animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none dark:bg-gray-700/50" />
								<div className="h-8 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-700/50" />
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				{message ? (
					<div className="flex items-center gap-2 rounded-circle bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 shadow-sm dark:bg-blue-600/20 dark:text-blue-400">
						<span
							className="h-3 w-3 shrink-0 animate-spin rounded-circle border-2 border-blue-200 border-t-blue-600 motion-reduce:animate-none dark:border-blue-400/30 dark:border-t-blue-400"
							aria-hidden="true"
						/>
						<span aria-hidden="true">{message}</span>
					</div>
				) : (
					<span
						className="h-5 w-5 animate-spin rounded-circle border-2 border-blue-200 border-t-blue-600 motion-reduce:animate-none dark:border-blue-400/30 dark:border-t-blue-400"
						aria-hidden="true"
					/>
				)}
				<span className="sr-only">{message ?? "Loading tasks"}</span>
			</div>
		</div>
	);
}
