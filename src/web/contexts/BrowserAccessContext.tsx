import { createContext, type ReactNode, useContext } from "react";
import type { BrowserSnapshot } from "../lib/browser-snapshot.ts";

const fullSections = { tasks: true, docs: true, decisions: true, milestones: true };
const BrowserAccessContext = createContext({ canWrite: true, sections: fullSections });

export function BrowserAccessProvider({ snapshot, children }: { snapshot?: BrowserSnapshot; children: ReactNode }) {
	const sections = snapshot
		? {
				tasks: snapshot.tasks !== undefined,
				docs: snapshot.docs !== undefined,
				decisions: snapshot.decisions !== undefined,
				milestones: snapshot.milestones !== undefined,
			}
		: fullSections;
	const access = { canWrite: !snapshot, sections };
	return <BrowserAccessContext.Provider value={access}>{children}</BrowserAccessContext.Provider>;
}

export function useBrowserAccess() {
	return useContext(BrowserAccessContext);
}
