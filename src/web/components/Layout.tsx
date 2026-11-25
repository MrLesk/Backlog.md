import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import Navigation from './Navigation';
import { DuplicateIdWarning } from './DuplicateIdWarning';
import type { DuplicateRepairPlan } from '../../core/duplicate-task-repair';
import { type Task, type Document, type Decision } from '../../types';
import { useAddressBarLocation } from '../contexts/AddressBarLocationContext';

const DRAWER_MEDIA_QUERY = '(width < 64rem)';

interface LayoutProps {
	projectName: string;
	pagePath: string;
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
	loadingMessage?: string | null;
	error?: Error | null;
	onRefreshData: () => Promise<void>;
	duplicateRepairPlan?: DuplicateRepairPlan | null;
	/** The open task's page, shown over the page beneath it while a task is open. */
	taskPage?: ReactNode;
}

/**
 * The layer that holds the task page over the current page. It returns keyboard focus to whatever opened the task,
 * a row, a card or a link, when the task closes. Focus while the task is open is TaskPageLayout's.
 */
function TaskPageLayer({ children }: { children: ReactNode }) {
	// Read while the layer first renders, before the page beneath becomes inert and loses its focus.
	const [opener] = useState(() => document.activeElement as HTMLElement | null);
	useEffect(
		() => () => {
			if (opener?.isConnected) opener.focus();
		},
		[opener],
	);
	return <div className="absolute inset-0 bg-surface">{children}</div>;
}

export default function Layout({
	projectName,
	pagePath,
	tasks,
	docs,
	decisions,
	isLoading,
	loadingMessage,
	error,
	onRefreshData,
	duplicateRepairPlan = null,
	taskPage,
}: LayoutProps) {
	// The address bar, not the page on screen: opening a task from the drawer, or another task from an open one, closes it.
	const addressBarLocation = useAddressBarLocation();
	const drawer = useRef<HTMLDialogElement>(null);
	const pageScroll = useRef<HTMLDivElement>(null);
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
	}, [addressBarLocation.key, closeDrawer]);

	// While a task is open, pagePath is that of the page beneath it, so opening and closing a task keep the reading
	// position of that page.
	useLayoutEffect(() => {
		if (pageScroll.current) pageScroll.current.scrollTop = 0;
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
	// inside one floating content panel beside it. Narrow screens open the sidebar in a drawer. The drawer sets
	// its own background and text color, because a dialog does not inherit them from body, and a right edge
	// against the dimmed page.
	// While a task is open, its page covers the page it was opened from, which stays mounted and inert: nothing in it
	// can be reached by keyboard, pointer or screen reader, and its scroll position, search, open groups and selection
	// are as they were when the task closes.
	return (
		<div className="h-dvh flex gap-2 overflow-hidden p-2">
			{useDrawer ? (
				<dialog
					ref={drawer}
					id="backlog-navigation"
					aria-label="Navigation menu"
					className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-80 max-w-full overflow-hidden border-r border-line bg-paper p-0 text-ink backdrop:bg-black/40"
					onClick={(event) => {
						if (event.target === event.currentTarget) closeDrawer();
					}}
				>
					{sideNavigation}
				</dialog>
			) : sideNavigation}
			<div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden rounded-panel border border-line bg-surface transition-colors duration-200">
				<Navigation projectName={projectName} loadingMessage={loadingMessage} onOpenMenu={useDrawer ? openDrawer : undefined} />
				<DuplicateIdWarning plan={duplicateRepairPlan} onRepaired={onRefreshData} />
				<main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					<div ref={pageScroll} inert={Boolean(taskPage)} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
						<Outlet context={{ tasks, docs, decisions, isLoading, error, onRefreshData }} />
					</div>
					{taskPage && <TaskPageLayer>{taskPage}</TaskPageLayer>}
				</main>
			</div>
		</div>
	);
}
