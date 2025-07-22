import { useHealthCheckContext } from "../contexts/HealthCheckContext";
import { SuccessToast } from "./SuccessToast";

export function HealthIndicator() {
	const { isOnline, retry } = useHealthCheckContext();

	// Show offline banner when connection is lost
	if (!isOnline) {
		return (
			<div className="fixed top-0 left-0 right-0 bg-red-500 dark:bg-red-600 text-white px-4 py-3 text-sm flex items-center justify-between shadow-lg z-50 animate-slide-in-down transition-colors duration-200">
				<div className="flex items-center gap-3">
					<div className="w-2 h-2 bg-white rounded-circle animate-pulse" />
					<span className="font-medium">
						Server disconnected
					</span>
				</div>
				<button
					onClick={retry}
					className="px-3 py-1.5 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 rounded text-xs font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-400"
				>
					Retry
				</button>
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