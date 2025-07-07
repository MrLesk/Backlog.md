import { useHealthCheck } from "../hooks/useHealthCheck";

export function HealthIndicator() {
	const { isOnline, lastCheck, isChecking, consecutiveFailures, retry } = useHealthCheck();

	// Don't show anything if we're online and have no issues
	if (isOnline && consecutiveFailures === 0) {
		return null;
	}

	// Show offline banner when connection is lost
	if (!isOnline) {
		return (
			<div className="bg-red-500 text-white px-4 py-2 text-sm flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="w-2 h-2 bg-white rounded-full animate-pulse" />
					<span>
						Connection lost. Please check if Backlog.md server is still running.
						{consecutiveFailures > 1 && ` (${consecutiveFailures} attempts)`}
						{lastCheck?.error && ` - ${lastCheck.error}`}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{isChecking && (
						<span className="text-xs opacity-75">Checking...</span>
					)}
					<button
						onClick={retry}
						disabled={isChecking}
						className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return null;
}

// Success toast component for when connection is restored
export function HealthSuccessToast({ onDismiss }: { onDismiss: () => void }) {
	return (
		<div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-right z-50">
			<div className="w-2 h-2 bg-white rounded-full" />
			<span className="font-medium">Connection restored!</span>
			<button
				onClick={onDismiss}
				className="ml-2 text-green-200 hover:text-white transition-colors"
			>
				✕
			</button>
		</div>
	);
}