import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
	theme: Theme;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Only an explicit toggle is stored. The old 'backlog-theme' key also held themes saved on
// every load, so it is not read: everyone follows the OS again until they toggle.
// index.html reads this key too, to apply the theme before the page renders.
const THEME_CHOICE_KEY = 'backlog-theme-choice';
const OS_DARK_QUERY = '(prefers-color-scheme: dark)';

const readOsTheme = (): Theme => (window.matchMedia?.(OS_DARK_QUERY).matches ? 'dark' : 'light');

const readThemeChoice = (): Theme | null => {
	const choice = localStorage.getItem(THEME_CHOICE_KEY);
	return choice === 'light' || choice === 'dark' ? choice : null;
};

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
};

interface ThemeProviderProps {
	children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
	const [osTheme, setOsTheme] = useState<Theme>(readOsTheme);
	const [themeChoice, setThemeChoice] = useState<Theme | null>(readThemeChoice);
	const theme = themeChoice ?? osTheme;

	useEffect(() => {
		const osDarkQuery = window.matchMedia?.(OS_DARK_QUERY);
		if (!osDarkQuery) {
			return;
		}
		const handleOsChange = (event: { matches: boolean }) => setOsTheme(event.matches ? 'dark' : 'light');
		osDarkQuery.addEventListener('change', handleOsChange);
		return () => osDarkQuery.removeEventListener('change', handleOsChange);
	}, []);

	useEffect(() => {
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}, [theme]);

	// Toggling to the theme the OS shows drops the choice, so the UI follows the OS again.
	const toggleTheme = () => {
		const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
		if (nextTheme === osTheme) {
			localStorage.removeItem(THEME_CHOICE_KEY);
			setThemeChoice(null);
		} else {
			localStorage.setItem(THEME_CHOICE_KEY, nextTheme);
			setThemeChoice(nextTheme);
		}
	};

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};
