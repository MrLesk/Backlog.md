import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, readMovedFailureState } from '../lib/api';

/**
 * The Archive button of the document page and the decision page, and what it does. It extends the
 * Archive flow of the task details view: the same native confirmation, the request to the server,
 * and the same handling of a record that moved while only the commit failed (`archiveState`).
 *
 * The server decides whether the record can be archived. This code passes the ID, shows the
 * server's message when it refuses, and leaves the page when the record is archived.
 */

/** What differs between the two pages: the noun, the list page, the CLI restore command and the route. */
const ARCHIVABLE_PAGES = {
	document: {
		noun: 'document',
		listPath: '/documentation',
		restoreCommand: 'backlog doc restore',
		archive: (id: string) => apiClient.archiveDoc(id),
	},
	decision: {
		noun: 'decision',
		listPath: '/decisions',
		restoreCommand: 'backlog decision restore',
		archive: (id: string) => apiClient.archiveDecision(id),
	},
} as const;

export type ArchivablePageKind = keyof typeof ARCHIVABLE_PAGES;

/**
 * Archives the record a page shows. `archive` asks for confirmation, sends one request at a time,
 * and on success refreshes the app's data and goes to the list page of the kind. When the server
 * refuses, `archiveError` holds its message and the page stays on the record. When the record
 * moved and only the commit failed, the browser says so in the short sentence the task details view
 * uses for the same case and treats the record as archived, as that view does.
 */
export function useRecordArchive(
	kind: ArchivablePageKind,
	record: { id: string; title: string } | null,
	routeIdentity: string | null,
	onRefreshData: () => Promise<void>,
) {
	const navigate = useNavigate();
	const [isArchiving, setIsArchiving] = useState(false);
	const route = useMemo(() => ({ identity: routeIdentity }), [routeIdentity]);
	const currentRoute = useRef<typeof route | null>(route);
	const [refusal, setRefusal] = useState<{ route: typeof route; message: string } | null>(null);
	// A ref as well as the state: two clicks in one render both see the state as it was.
	const requestRunning = useRef(false);

	// Route ownership changes before async completions can act, and ends on unmount.
	useLayoutEffect(() => {
		currentRoute.current = route;
		return () => {
			currentRoute.current = null;
		};
	}, [route]);

	const archive = useCallback(async () => {
		if (!record || !route.identity || currentRoute.current !== route || requestRunning.current) return;
		const page = ARCHIVABLE_PAGES[kind];
		const question = `Archive "${record.title}"? It leaves the sidebar and search. Restore it from the CLI with: ${page.restoreCommand} ${record.id}`;
		if (!window.confirm(question)) return;

		requestRunning.current = true;
		setIsArchiving(true);
		setRefusal(null);
		try {
			try {
				await page.archive(record.id);
			} catch (error) {
				if (!readMovedFailureState(error, 'archiveState')) {
					// Refused: the record is where it was, and the server's message is the answer.
					if (currentRoute.current === route) {
						setRefusal({ route, message: error instanceof Error ? error.message : String(error) });
					}
					return;
				}
				// The record reached the archive and only the commit failed. Say so as the task details view
				// does, and leave the page: a page left open on an archived record invites a second archive.
				// The server logs the Git error.
				try {
					if (currentRoute.current === route) {
						window.alert(
							`The ${page.noun} was archived, but committing the change failed. Check the repository before retrying.`,
						);
					}
				} catch {
					// A blocked dialog must not keep the page on the archived record.
				}
			}
			await onRefreshData();
			if (currentRoute.current === route) navigate(page.listPath);
		} finally {
			requestRunning.current = false;
			setIsArchiving(false);
		}
	}, [kind, record, route, onRefreshData, navigate]);

	return {
		archive,
		isArchiving,
		archiveError: refusal?.route === route ? refusal.message : null,
		dismissArchiveError: () => setRefusal(null),
	};
}

/** The header button. It looks like the other header buttons, in the red of the task Archive button. */
export function ArchiveButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-busy={disabled}
			className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		>
			<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
			</svg>
			Archive
		</button>
	);
}

/** Shown in the header of an archived record, which the page shows read-only. */
export function ArchivedLabel() {
	return (
		<span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700">
			Archived
		</span>
	);
}

/** The server's message when it refused the archive, under the header, until dismissed. */
export function ArchiveRefusal({ message, onDismiss }: { message: string; onDismiss: () => void }) {
	return (
		<div role="alert" className="max-w-4xl mx-auto px-8 pb-4">
			<div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3">
				<span className="flex-1 text-sm text-red-700 dark:text-red-200 break-words">{message}</span>
				<button
					type="button"
					onClick={onDismiss}
					aria-label="Dismiss"
					className="text-red-700 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
				>
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	);
}
