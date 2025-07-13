import { useHealthCheck } from "../hooks/useHealthCheck";
import { SuccessToast } from "./SuccessToast";

export function HealthIndicator() {
	const { isOnline, isChecking, consecutiveFailures, retry } = useHealthCheck();

	// Don't show anything if we're online and have no issues
	if (isOnline && consecutiveFailures === 0) {
		return null;
	}

	// Show offline banner when connection is lost
	if (!isOnline) {
		return (
			<div className="fixed top-0 left-0 right-0 bg-red-500 dark:bg-red-600 text-white px-4 py-3 text-sm flex items-center justify-between shadow-lg z-50 animate-slide-in-down transition-colors duration-200">
				<div className="flex items-center gap-3">
					<div className="w-2 h-2 bg-white rounded-full animate-pulse" />
					<span className="font-medium">
						Server disconnected
					</span>
				</div>
				<div className="flex items-center gap-3">
					{isChecking && (
						<span className="text-xs opacity-75 animate-pulse">Checking...</span>
					)}
					<button
						onClick={retry}
						disabled={isChecking}
						className="px-3 py-1.5 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 rounded text-xs font-medium transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-400"
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
		<SuccessToast 
			message="Connection restored!" 
			onDismiss={onDismiss}
		/>
	);
}