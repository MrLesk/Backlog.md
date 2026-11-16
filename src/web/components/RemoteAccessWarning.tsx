import { isLoopbackBrowserHostname, REMOTE_ACCESS_WARNING } from "../../utils/browser-host.ts";

export function RemoteAccessWarning({ hostname }: { hostname: string }) {
	if (isLoopbackBrowserHostname(hostname)) return null;
	return (
		<div role="alert" className="rounded-lg border border-red-500 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100 whitespace-pre-line">
			{REMOTE_ACCESS_WARNING}
		</div>
	);
}
