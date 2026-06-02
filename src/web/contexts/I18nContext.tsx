import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getDictionary, type Locale, type TranslationDict, isValidLocale } from "../locales";
import { apiClient } from "../lib/api";

interface I18nContextType {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: TranslationDict;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18nContext = () => {
	const context = useContext(I18nContext);
	if (context === undefined) {
		throw new Error("useI18nContext must be used within I18nProvider");
	}
	return context;
};

interface I18nProviderProps {
	children: React.ReactNode;
	initialLocale?: Locale;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
	children,
	initialLocale = "en",
}) => {
	const [locale, setLocaleState] = useState<Locale>(initialLocale);

	useEffect(() => {
		apiClient.fetchConfig().then((config) => {
			if (config.locale && isValidLocale(config.locale)) {
				setLocaleState(config.locale);
			}
		}).catch(() => {
			// ignore: fallback to initialLocale
		});
	}, []);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
	}, []);

	const t = getDictionary(locale);

	return (
		<I18nContext.Provider value={{ locale, setLocale, t }}>
			{children}
		</I18nContext.Provider>
	);
};
