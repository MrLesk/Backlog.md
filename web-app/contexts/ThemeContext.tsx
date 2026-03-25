"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
	theme: Theme;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
	return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [theme, setTheme] = useState<Theme>("light");

	// Initialize from localStorage/system preference after mount (SSR-safe)
	useEffect(() => {
		const saved = localStorage.getItem("backlog-theme") as Theme | null;
		if (saved === "light" || saved === "dark") {
			setTheme(saved);
		} else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
			setTheme("dark");
		}
	}, []);

	useEffect(() => {
		const root = document.documentElement;
		if (theme === "dark") root.classList.add("dark");
		else root.classList.remove("dark");
		localStorage.setItem("backlog-theme", theme);
	}, [theme]);

	const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

	return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};
