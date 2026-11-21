import { createContext, type ReactNode, useContext } from "react";
import type { BrowserSnapshot } from "../lib/browser-snapshot.ts";

const liveAccess = { canWrite: true, tasksOnly: false };
const BrowserAccessContext = createContext(liveAccess);

export function BrowserAccessProvider({ snapshot, children }: { snapshot?: BrowserSnapshot; children: ReactNode }) {
	const access = snapshot ? { canWrite: false, tasksOnly: snapshot.tasksOnly } : liveAccess;
	return <BrowserAccessContext.Provider value={access}>{children}</BrowserAccessContext.Provider>;
}

export function useBrowserAccess() {
	return useContext(BrowserAccessContext);
}
