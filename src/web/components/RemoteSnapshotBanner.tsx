import { useEffect, useState } from 'react';
import { apiClient, type RemoteSnapshotInfo } from '../lib/api';

/**
 * Thin banner shown only when the server is rendering a remote repo's cached
 * snapshot (started via `backlog browser --repo`). Makes it clear that edits
 * stay in the local cache and are not pushed upstream. Renders nothing for
 * normal local projects.
 */
export default function RemoteSnapshotBanner() {
	const [snapshot, setSnapshot] = useState<RemoteSnapshotInfo | null>(null);

	useEffect(() => {
		let active = true;
		apiClient
			.fetchRemoteSnapshot()
			.then((info) => {
				if (active) setSnapshot(info);
			})
			.catch(() => {
				/* non-fatal: just hide the banner */
			});
		return () => {
			active = false;
		};
	}, []);

	if (!snapshot) return null;

	return (
		<div className="px-8 py-2 text-sm bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900">
			Viewing remote snapshot <span className="font-semibold">{snapshot.label}</span>. Edits are saved to the local
			cache only and are not pushed to the source repo.
		</div>
	);
}
