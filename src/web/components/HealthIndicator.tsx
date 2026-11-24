export function HealthIndicator({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="fixed top-0 left-0 right-0 bg-red-500 dark:bg-red-600 text-white px-4 py-3 text-sm flex items-center justify-between shadow-lg z-50 animate-slide-in-down transition-colors duration-200">
			<div className="flex items-center gap-3">
				<div className="w-2 h-2 bg-white rounded-circle animate-pulse" />
				<span className="font-medium">Server disconnected</span>
			</div>
			<button
				type="button"
				onClick={onRetry}
				className="px-3 py-1.5 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 rounded text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-400"
			>
				Retry
			</button>
		</div>
	);
}
