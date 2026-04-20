import { Outlet } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import Navigation from './Navigation';
import { HealthIndicator, HealthSuccessToast } from './HealthIndicator';
import { type Task, type Document, type Decision } from '../../types';
import type { ProjectSummary } from '../lib/api';

interface LayoutProps {
	projectName: string;
	projects: ProjectSummary[];
	currentProject: string | null;
	onProjectChange: (projectKey: string) => void;
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
	projects,
	currentProject,
	onProjectChange,
	showSuccessToast, 
	onDismissToast, 
	tasks, 
	docs, 
	decisions, 
	isLoading, 
	onRefreshData 
}: LayoutProps) {
	return (
		<div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden transition-colors duration-200">
			<HealthIndicator />
			<SideNavigation 
				tasks={tasks}
				docs={docs}
				decisions={decisions}
				isLoading={isLoading}
				onRefreshData={onRefreshData}
			/>
			<div className="flex-1 flex flex-col min-h-0 min-w-0">
				<Navigation
					projectName={projectName}
					projects={projects}
					currentProject={currentProject}
					onProjectChange={onProjectChange}
				/>
				<main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
					<Outlet context={{ tasks, docs, decisions, isLoading, onRefreshData }} />
				</main>
			</div>
			{showSuccessToast && (
				<HealthSuccessToast onDismiss={onDismissToast} />
			)}
		</div>
	);
}
