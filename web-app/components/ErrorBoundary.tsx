import React from 'react';

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
	errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

const DefaultErrorFallback: React.FC<{ error?: Error; resetError: () => void }> = ({ error, resetError }) => (
	<div className="flex flex-col items-center justify-center min-h-96 p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-200">
		<div className="text-center max-w-md">
			<svg className="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
			</svg>
			<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Something went wrong</h3>
			<p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
				An unexpected error occurred. Please try refreshing the page.
			</p>
			{error && process.env.NODE_ENV === 'development' && (
				<details className="mt-4 text-left">
					<summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Technical Details</summary>
					<pre className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto transition-colors duration-200">
						{error.message}
					</pre>
				</details>
			)}
			<button
				onClick={resetError}
				className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 dark:bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-200 cursor-pointer"
			>
				Try Again
			</button>
		</div>
	</div>
);

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return {
			hasError: true,
			error,
		};
	}

	override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.setState({
			error,
			errorInfo,
		});

		// Log error to console in development
		if (process.env.NODE_ENV === 'development') {
			console.error('ErrorBoundary caught an error:', error, errorInfo);
		}

		// Call optional error handler
		this.props.onError?.(error, errorInfo);
	}

	resetError = () => {
		this.setState({
			hasError: false,
			error: undefined,
			errorInfo: undefined,
		});
	};

	override render() {
		if (this.state.hasError) {
			const FallbackComponent = this.props.fallback || DefaultErrorFallback;
			return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
		}

		return this.props.children;
	}
}

export default ErrorBoundary;