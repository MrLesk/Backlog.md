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
	<div className="flex flex-col items-center justify-center min-h-96 p-8 bg-gray-50 rounded-lg border border-gray-200">
		<div className="text-center max-w-md">
			<svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
			</svg>
			<h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
			<p className="text-sm text-gray-600 mb-4">
				An unexpected error occurred. Please try refreshing the page.
			</p>
			{error && process.env.NODE_ENV === 'development' && (
				<details className="mt-4 text-left">
					<summary className="text-sm font-medium text-gray-700 cursor-pointer">Technical Details</summary>
					<pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
						{error.message}
					</pre>
				</details>
			)}
			<button
				onClick={resetError}
				className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
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

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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

	render() {
		if (this.state.hasError) {
			const FallbackComponent = this.props.fallback || DefaultErrorFallback;
			return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
		}

		return this.props.children;
	}
}

export default ErrorBoundary;