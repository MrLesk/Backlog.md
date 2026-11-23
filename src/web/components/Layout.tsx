import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import Navigation from './Navigation';
import { HealthIndicator, HealthSuccessToast } from './HealthIndicator';
import { DuplicateIdWarning } from './DuplicateIdWarning';
import type { DuplicateRepairPlan } from '../../core/duplicate-task-repair';
import { type Task, type Document, type Decision } from '../../types';

const DRAWER_MEDIA_QUERY = '(width < 64rem)';

interface LayoutProps {
	projectName: string;
	pagePath: string;
	showSuccessToast: boolean;
	onDismissToast: () => void;
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
	loadingMessage?: string | null;
	error?: Error | null;
	onRefreshData: () => Promise<void>;
	duplicateRepairPlan?: DuplicateRepairPlan | null;
}

export default function Layout({
	projectName,
	pagePath,
	showSuccessToast,
	onDismissToast,
	tasks,
	docs,
	decisions,
	isLoading,
	loadingMessage,
	error,
	onRefreshData,
	duplicateRepairPlan = null,
}: LayoutProps) {
	const location = useLocation();
	const drawer = useRef<HTMLDialogElement>(null);
	const main = useRef<HTMLElement>(null);
	const [useDrawer, setUseDrawer] = useState(() => window.matchMedia?.(DRAWER_MEDIA_QUERY).matches ?? false);

	const openDrawer = useCallback(() => {
		const dialog = drawer.current;
		if (dialog && !dialog.open) dialog.showModal();
	}, []);

	const closeDrawer = useCallback(() => drawer.current?.close(), []);

	useEffect(() => {
		const query = window.matchMedia?.(DRAWER_MEDIA_QUERY);
		if (!query) return;

		const update = () => {
			if (!query.matches) closeDrawer();
			setUseDrawer(query.matches);
		};
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	}, [closeDrawer]);

	useEffect(() => {
		closeDrawer();
	}, [location.key, closeDrawer]);

	// A task dialog shares its board or list's page path and reading position.
	useLayoutEffect(() => {
		if (main.current) main.current.scrollTop = 0;
	}, [pagePath]);

	const sideNavigation = (
		<SideNavigation
			taskCount={tasks.length}
			docs={docs}
			decisions={decisions}
			isLoading={isLoading}
			error={error}
			onRetry={onRefreshData}
			onRefreshData={onRefreshData}
			onOpenDrawer={useDrawer ? openDrawer : undefined}
			onCloseDrawer={useDrawer ? closeDrawer : undefined}
		/>
	);

	// The sidebar sits on the page background (paper, set on body in source.css) and every page renders
	// inside one floating content panel beside it. Narrow screens open the sidebar in a drawer that paints
	// the same background itself.
	return (
		<div className="h-dvh flex gap-2 overflow-hidden p-2">
			<HealthIndicator />
			{useDrawer ? (
				<dialog
					ref={drawer}
					id="backlog-navigation"
					aria-label="Navigation menu"
					className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-80 max-w-full overflow-hidden bg-paper p-0 backdrop:bg-black/40"
					onClick={(event) => {
						if (event.target === event.currentTarget) closeDrawer();
					}}
				>
					{sideNavigation}
				</dialog>
			) : sideNavigation}
			<div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden rounded-panel border border-line bg-surface">
				<Navigation projectName={projectName} loadingMessage={loadingMessage} onOpenMenu={useDrawer ? openDrawer : undefined} />
				<DuplicateIdWarning plan={duplicateRepairPlan} onRepaired={onRefreshData} />
				<main ref={main} className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
					<Outlet context={{ tasks, docs, decisions, isLoading, error, onRefreshData }} />
				</main>
			</div>
			{showSuccessToast && (
				<HealthSuccessToast onDismiss={onDismissToast} />
			)}
		</div>
	);
}
