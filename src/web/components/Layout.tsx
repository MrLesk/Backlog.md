import React from 'react';
import { Outlet } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import Navigation from './Navigation';
import { HealthIndicator, HealthSuccessToast } from './HealthIndicator';
import { type Task, type Document, type Decision, type Milestone } from '../../types';

interface LayoutProps {
	projectName: string;
	showSuccessToast: boolean;
	onDismissToast: () => void;
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	milestones: Milestone[];
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
	milestones,
	isLoading,
	onRefreshData
}: LayoutProps) {
	return (
		<div className="h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
			<HealthIndicator />
			<SideNavigation
				tasks={tasks}
				docs={docs}
				decisions={decisions}
				milestones={milestones}
				isLoading={isLoading}
				onRefreshData={onRefreshData}
			/>
			<div className="flex-1 flex flex-col min-h-0">
				<Navigation projectName={projectName} />
				<main className="flex-1 overflow-auto">
					<Outlet context={{ tasks, docs, decisions, milestones, isLoading, onRefreshData }} />
				</main>
			</div>
			{showSuccessToast && (
				<HealthSuccessToast onDismiss={onDismissToast} />
			)}
		</div>
	);
}