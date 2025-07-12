import React from 'react';
import { Outlet } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import Navigation from './Navigation';
import { HealthIndicator, HealthSuccessToast } from './HealthIndicator';
import { type Task, type Document, type Decision } from '../../types';

interface LayoutProps {
	projectName: string;
	showSuccessToast: boolean;
	onDismissToast: () => void;
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
	onRefreshData: () => Promise<void>;
}

export default function Layout({ 
	projectName, 
	showSuccessToast, 
	onDismissToast, 
	tasks, 
	docs, 
	decisions, 
	isLoading, 
	onRefreshData 
}: LayoutProps) {
	return (
		<div className="h-screen bg-gray-50 flex">
			<HealthIndicator />
			<SideNavigation 
				tasks={tasks}
				docs={docs}
				decisions={decisions}
				isLoading={isLoading}
				onRefreshData={onRefreshData}
			/>
			<div className="flex-1 flex flex-col min-h-0">
				<Navigation projectName={projectName} />
				<main className="flex-1 overflow-hidden">
					<Outlet context={{ tasks, docs, decisions, isLoading, onRefreshData }} />
				</main>
			</div>
			{showSuccessToast && (
				<HealthSuccessToast onDismiss={onDismissToast} />
			)}
		</div>
	);
}