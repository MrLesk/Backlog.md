import { createContext, type ReactNode, useContext } from "react";
import { type Location, useLocation } from "react-router-dom";

/**
 * The location in the address bar. While a task is open, App renders the pages with the location of the page beneath
 * the task (pageBeneath in lib/task-links.ts), so inside them useLocation(), useSearchParams() and a relative navigate()
 * all act on that page, not on the address bar. A write from there would replace the task's address and close the task,
 * so a page beneath a task must not navigate: it checks useAddressBarLocation() first, as the Tasks page does before it
 * tidies its query. What must follow the address bar, such as a task link deciding whether it replaces the open task,
 * reads useAddressBarLocation() too.
 */
const AddressBarLocationContext = createContext<Location | null>(null);

/** Provides the address bar's location to everything inside it. App places it outside its routes. */
export function AddressBarLocationProvider({ children }: { children: ReactNode }) {
	return <AddressBarLocationContext.Provider value={useLocation()}>{children}</AddressBarLocationContext.Provider>;
}

/**
 * The location in the address bar. Without a provider (a component rendered on its own, as in a test) no page is
 * rendered beneath a task, so the router's location is the address bar's.
 */
export function useAddressBarLocation(): Location {
	const routerLocation = useLocation();
	return useContext(AddressBarLocationContext) ?? routerLocation;
}
