import React, { memo } from 'react';

interface LoadingSpinnerProps {
	size?: 'sm' | 'md' | 'lg';
	text?: string;
	className?: string;
}

export const LoadingSpinner = memo(function LoadingSpinner({ 
	size = 'md', 
	text = 'Loading...', 
	className = '' 
}: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-6 h-6',
		lg: 'w-8 h-8',
	};

	return (
		<div className={`flex items-center justify-center ${className}`}>
			<div className="flex flex-col items-center space-y-3">
				<div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
				{text && (
					<p className="text-sm text-gray-600 font-medium">{text}</p>
				)}
			</div>
		</div>
	);
});

interface LoadingSkeletonProps {
	lines?: number;
	className?: string;
}

export const LoadingSkeleton = memo(function LoadingSkeleton({ 
	lines = 3, 
	className = '' 
}: LoadingSkeletonProps) {
	return (
		<div className={`animate-pulse ${className}`}>
			{Array.from({ length: lines }, (_, i) => (
				<div key={i} className={`bg-gray-200 rounded h-4 mb-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
			))}
		</div>
	);
});

interface SidebarSkeletonProps {
	isCollapsed?: boolean;
}

export const SidebarSkeleton = memo(function SidebarSkeleton({ isCollapsed = false }: SidebarSkeletonProps) {
	if (isCollapsed) {
		return (
			<div className="px-2 py-2 space-y-2 animate-pulse">
				{Array.from({ length: 4 }, (_, i) => (
					<div key={i} className="w-full h-10 bg-gray-200 rounded-lg" />
				))}
			</div>
		);
	}

	return (
		<div className="px-4 py-4 space-y-4 animate-pulse">
			{/* Search skeleton */}
			<div className="h-10 bg-gray-200 rounded-lg" />
			
			{/* Navigation items */}
			{Array.from({ length: 3 }, (_, i) => (
				<div key={i} className="flex items-center space-x-3 px-3 py-2">
					<div className="w-5 h-5 bg-gray-200 rounded" />
					<div className="h-4 bg-gray-200 rounded flex-1" />
				</div>
			))}

			{/* Section headers */}
			{Array.from({ length: 2 }, (_, sectionIndex) => (
				<div key={sectionIndex} className="space-y-2">
					<div className="flex items-center space-x-3 mb-3">
						<div className="w-4 h-4 bg-gray-200 rounded" />
						<div className="h-4 bg-gray-200 rounded w-24" />
					</div>
					{Array.from({ length: 3 }, (_, itemIndex) => (
						<div key={itemIndex} className="flex items-center space-x-3 px-3 py-2">
							<div className="w-4 h-4 bg-gray-200 rounded" />
							<div className="h-3 bg-gray-200 rounded flex-1" />
						</div>
					))}
				</div>
			))}
		</div>
	);
});

export default LoadingSpinner;